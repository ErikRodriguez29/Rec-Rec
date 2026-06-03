library(lubridate)
library(tidyverse)
library(tidymodels)
library(timetk)

for (path in c(
  "utils.R",
  file.path("R", "utils.R"),
  file.path("scripts", "R", "utils.R"),
  file.path("src", "scripts", "R", "utils.R")
)) {
  if (file.exists(path)) {
    source(path)
    break
  }
}

set.seed(123)

# ==============================
# WEEK DIRECTORY HANDLING
# ==============================

week_info <- get_week_info()
current_week <- week_info$current_week
current_monday <- week_info$current_monday

# Model save path
model_dir <- file.path(
  ensure_output_dir("tuned_models", paste0("Week ", current_week)),
  ""
)

# Multiprocessing training with future
library(future)
library(doFuture)
n_workers <- min(4L, max(1L, parallel::detectCores(logical = FALSE) - 1L))
plan(multisession, workers = n_workers)
options(future.globals.maxSize = 3 * 1024^3)
registerDoFuture()
on.exit(plan(sequential), add = TRUE)


# Loading

attendance_raw <- read_facility_counts("../../data/facility_counts.csv")

days_of_week <- DAYS_OF_WEEK

# Build the weekly training panel (one row per facility x day x hour x week)
attendance <- build_weekly_training_panel(attendance_raw, days_of_week = days_of_week)

# Drop the last partial week of data since it is not complete
attendance <- attendance %>%
  filter(week_start < max(attendance$week_start))

# Training/testing split/folds (assess = 1 period = one week_start value)
attendance_split_ts <- attendance %>%
  arrange(week_start, facility_name, day_of_week, hour) %>%
  time_series_split(
    date_var = week_start,
    assess = 1,
    cumulative = TRUE
  )

train_data_ts <- training(attendance_split_ts)
test_data_ts <- testing(attendance_split_ts)

ts_folds <- time_series_cv(
  data = train_data_ts,
  date_var = week_start,
  assess = 1, # Each fold's assessment window in terms of weeks
  initial = 3, # Minimum training window per fold in terms of weeks
  skip = 1, # Gap between training and assessment windows in terms of weeks
  slice_limit = 10, # Number of folds
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
library(xgboost)
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


# Rank models by RMSE and pull the ID of the best model
model_rankings <- rank_results(race_results, rank_metric = "rmse", select_best = TRUE)
best_model_id <- model_rankings$wflow_id[1]
best_model_type <- model_rankings$model[1]

# Extract the best parameters for the best model (hyperparameters only)
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

# Finalize, Fit, and Save
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
