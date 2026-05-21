library(lubridate)
library(tidyverse)
library(tidymodels)
library(timetk)

for (path in c(
  "utils.R",
  file.path("scripts", "utils.R"),
  file.path("src", "scripts", "utils.R")
)) {
  if (file.exists(path)) {
    source(path)
    break
  }
}

# ==============================
# WEEK DIRECTORY HANDLING
# ==============================

week_info <- get_week_info()
current_week <- week_info$current_week
current_monday <- week_info$current_monday

# Model save path
model_dir <- paste0(
  "../tuned_models/Week ",
  current_week,
  "/"
)

# Create directory
if (!dir.exists(model_dir)) {
  dir.create(model_dir, recursive = TRUE)
}


# Multiprocessing training with future
library(future)
library(doFuture)
plan(multisession, workers = parallel::detectCores(logical = FALSE))
registerDoFuture()


# Loading

attendance_raw <- read_facility_counts("../data/facility_counts.csv")

days_of_week <- DAYS_OF_WEEK

attendance <- attendance_raw %>%
  parse_attendance_timestamps(days_of_week = days_of_week) %>%
  mutate(is_raining = factor(is_raining))


# Pre processing
facility_capacities <- attendance_raw %>%
  distinct(facility_name, total_capacity)

attendance <- attendance %>%
  mutate(facility_name = fct_drop(facility_name)) %>%
  filter_to_open_hours()


# 1. Create all combinations of hours, days, facilities
all_combinations <- expand.grid(
  facility_name = unique(attendance$facility_name),
  day_of_week = factor(days_of_week),
  hour = 0:23
)

# 2. Apply the open hour filter to all combinations
combination_schedule <- all_combinations %>%
  filter_to_open_hours() %>%
  left_join(facility_capacities, by = "facility_name")

# 3. Join the combination schedule to the attendance dataset
attendance <- combination_schedule %>%
  left_join(
    # Removing percentage_filled so we can recalculate it later, total capacity to avoid conflicts
    attendance %>% select(-percentage_filled, -total_capacity),
    by = c("facility_name", "day_of_week", "hour")
  ) %>%
  # Refactor everything properly
  mutate(
    facility_name = factor(facility_name, levels = levels(attendance$facility_name)),
    day_of_week = factor(day_of_week, levels = days_of_week)
  )

# Recalculate percentage_filled
attendance <- attendance %>%
  mutate(percentage_filled = (current_count / total_capacity) * 100)


# Pre impute the missing current_count values with median imputation
attendance <- attendance %>%
  group_by(facility_name, day_of_week, hour) %>%
  mutate(current_count = if_else(
    is.na(current_count),
    median(current_count, na.rm = TRUE),
    current_count
  )) %>%
  ungroup() %>%
  group_by(facility_name) %>%
  mutate(current_count = if_else(
    is.na(current_count),
    median(current_count, na.rm = TRUE),
    current_count
  )) %>%
  ungroup()


# Time split pre processing

# Get the Monday of the earliest observed week as an anchor
anchor_date <- attendance %>%
  filter(!is.na(timestamp)) %>%
  summarize(min(floor_date(timestamp, "week", week_start = 1))) %>%
  pull()

# Fill NA timestamps with synthetic values built from anchor date + day + hour, with offset seconds per facility to prevent duplicate timestamps
attendance <- attendance %>%
  mutate(timestamp = if_else(
    is.na(timestamp),
    anchor_date +
      days(match(day_of_week, days_of_week) - 1) +
      hours(hour) +
      seconds(as.integer(facility_name) - 1L),
    timestamp
  ))

# Update the sorting to account for the synthetic timestamps
attendance <- attendance %>%
  arrange(timestamp)

attendance <- add_panel_lag_features(attendance)
attendance <- assign_facility_type(attendance)

# Training/testing split/folds

attendance_split_ts <- attendance %>%
  arrange(timestamp) %>%
  time_series_split(
    date_var   = timestamp,
    assess     = "1 week", # hold out the last 1 week as test set
    cumulative = TRUE # use all prior data for training
  )

train_data_ts <- training(attendance_split_ts)
test_data_ts <- testing(attendance_split_ts)

ts_folds <- time_series_cv(
  data = train_data_ts,
  date_var = timestamp,
  assess = "1 week", # each fold's assessment window
  initial = "21 days", # minimum training window per fold
  skip = "1 week",
  slice_limit = 8, # number of folds
  cumulative = TRUE
)


attendance_recipe_ts <- recipe(
  current_count ~ hour + day_of_week + facility_name + facility_type +
    is_raining + lag_1w + roll_4w,
  data = train_data_ts
) %>%
  step_unknown(is_raining) %>%
  step_dummy(all_nominal_predictors()) %>%
  step_zv(all_predictors()) %>%
  step_normalize(all_numeric_predictors(), -lag_1w, -roll_4w)


# Model setup

# Tuning trees, learn_rate (the learning rate), and min_n
library(bonsai)
boosted_model <- boost_tree(
  trees = tune(),
  learn_rate = tune(),
  min_n = tune()
) %>%
  set_engine("xgboost") %>%
  set_mode("regression")


library(finetune)

# Combine workflows into a set
model_set <-
  workflow_set(
    preproc = list(base_rec = attendance_recipe_ts),
    models = list(boosted = boosted_model)
  )

# Define a racing control object (this drops poor hyperparameter combos early)
race_ctrl <- control_race(
  save_pred = FALSE,
  parallel_over = "resamples",
  save_workflow = FALSE,
  verbose = TRUE, # Show general progress
  verbose_elim = TRUE # Show which models are discarded during racing
)

# Run the racing search across all models in the set
# This replaces multiple tune_grid() calls
race_results <- model_set %>%
  workflow_map(
    "tune_race_anova",
    resamples = ts_folds,
    grid = 8, # Number of candidate models to try per type
    control = race_ctrl,
    metrics = metric_set(rmse, rsq)
  )

# Results & Best Model
ggsave(
  filename = "race_results_autoplot.png",
  plot = autoplot(race_results),
  path = model_dir
)
best_results <- race_results %>%
  extract_workflow_set_result("base_rec_boosted") %>%
  select_best(metric = "rmse")


# 1. Rank models by RMSE and pull the ID of the #1 winner
model_rankings <- rank_results(race_results, rank_metric = "rmse", select_best = TRUE)
best_model_id <- model_rankings$wflow_id[1]
best_model_type <- model_rankings$model[1]

# 2. Extract the best parameters for the best model (hyperparameters only)
best_params <- race_results %>%
  extract_workflow_set_result(best_model_id) %>%
  select_best(metric = "rmse")

# Get the CV (Cross-Validated) RMSE value of the best model
best_model_rmse <- race_results %>%
  extract_workflow_set_result(best_model_id) %>%
  show_best(metric = "rmse", n = 1) %>%
  dplyr::pull("mean")

cat("Best model parameters:\n")
print(best_params)
cat("CV RMSE of best model:", best_model_rmse, "\n")

# 3. Finalize, Fit, and Save
final_wf_winner <- race_results %>%
  extract_workflow(best_model_id) %>%
  finalize_workflow(best_params)

# This is the final model ready for production
final_fit_winner <- final_wf_winner %>% fit(data = train_data_ts)

saveRDS(
  final_fit_winner,
  file = paste0(
    model_dir,
    "final_attendance_workflow.rds"
  )
)

print(paste(
  "Saved trained model to:",
  model_dir
))


# Export all candidates ranked by CV RMSE (best = lowest) to model_dir
all_candidates <- purrr::map_dfr(
  unique(race_results$wflow_id),
  function(wid) {
    race_results %>%
      extract_workflow_set_result(wid) %>%
      show_best(metric = "rmse", n = Inf) %>%
      mutate(wflow_id = wid, .before = 1)
  }
) %>%
  arrange(mean)

race_export <- all_candidates %>%
  dplyr::select(
    wflow_id,
    dplyr::any_of("model"),
    trees,
    learn_rate,
    min_n,
    rmse = mean,
    std_err,
    n
  )

race_results_path <- file.path(model_dir, "race_results.txt")
readr::write_csv(race_export, file.path(model_dir, "race_results.csv"))
writeLines(
  c(
    paste("Race results — CV RMSE ranked best to worst (Week", current_week, ")"),
    paste("Generated:", Sys.time()),
    "",
    capture.output(print(race_export, n = Inf, width = Inf))
  ),
  con = race_results_path
)
print(paste("Wrote race results to:", race_results_path))
