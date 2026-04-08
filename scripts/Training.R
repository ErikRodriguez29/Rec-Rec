library(lubridate)
library(tidyverse)
library(tidymodels)
library(timetk)

# ==============================
# WEEK DIRECTORY HANDLING
# ==============================

week1_start <- as.Date("2026-01-26")
today_date <- Sys.Date()

# Find Monday of current week
current_monday <- today_date -
  lubridate::wday(today_date, week_start = 1) + 1

# Find Monday of Week 1
week1_monday <- week1_start -
  lubridate::wday(week1_start, week_start = 1) + 1

# Calculate current week number
current_week <- as.integer(
  difftime(current_monday,
           week1_monday,
           units = "weeks")
) + 1

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
library(doParallel)
all_cores <- parallel::detectCores(logical = FALSE)
registerDoParallel(cores = all_cores)


# Loading

attendance_raw <- read_csv("../data/facility_counts.csv")

# Single character days of week labels used, where 0 corresponds to Monday, 6 to Sunday
days_of_week = c("M", "T", "W", "R", "F", "S", "U")

attendance <- attendance_raw %>%
  mutate(
    # Parse the timestamp and pull the hour
    timestamp = ymd_hms(timestamp),
    hour = hour(timestamp),
    # Label day of the week from Monday through Sunday
    day_of_week = factor(day_of_week, levels = 0:6, labels = days_of_week),
    facility_name = factor(facility_name)
  ) %>%
  # Arrange all observations alphabetically and by ascending timestamp
  arrange(facility_name, timestamp)



# Pre processing
facility_capacities <- attendance_raw %>%
  distinct(facility_name, total_capacity)

pool_hours_facilities <- c("Small Pool",
                           "Big Pool",
                           "Spa",
                           "Pool Deck"
)
climb_center_facility <- c("Climbing Center - MAC")

# Standard facility hours throughout the week (named by their weekday character)
# In the case a facility closes at an exact hour, we exclude that final hour (i.e 6am - 11pm means we would exclude 11pm or hour 23)
standard_hours_m_r <- 6:22 #M-T 6am - 11pm
standard_hours_f <- 6:20 #F 6am - 9pm
standard_hours_s <- 9:20 #S 9am - 9pm
standard_hours_u <- 9:20 #U 9am - 10pm

# Pool hours only vary on weekdays and weekends
pool_hours_m_f <- 6:19 #F 6am - 9pm
pool_hours_s_u <- 9:19 #S-U 9am - 8pm

# Climbing center hours only reduced from Friday through Sunday
climb_hours_m_r <- 11:21 #M-R 11:30am - 10pm
climb_hours_f_u <- 11:20 #F-U 11:30am - 8:30pm

attendance <- attendance %>%
  # Remove Racquetball Court 5
  filter(facility_name != "Racquetball Court 5") %>%
  mutate(facility_name = fct_drop(facility_name)) %>% 
  filter(
    # Logic for Pool Facilities
    (facility_name %in% pool_hours_facilities & (
      (day_of_week %in% c("M", "T", "W", "R", "F") & hour %in% pool_hours_m_f) |
        (day_of_week %in% c("S", "U") & hour %in% pool_hours_s_u)
    )) |
      # Logic for Climbing Center
      (facility_name %in% climb_center_facility & (
        (day_of_week %in% c("M", "T", "W", "R") & hour %in% climb_hours_m_r) |
          (day_of_week %in% c("F", "S", "U") & hour %in% climb_hours_f_u)
      )) |
      # Logic for Standard Facilities (all others)
      (!(facility_name %in% pool_hours_facilities | facility_name %in% climb_center_facility) & (
        (day_of_week %in% c("M", "T", "W", "R") & hour %in% standard_hours_m_r) |
          (day_of_week == "F" & hour %in% standard_hours_f) |
          (day_of_week == "S" & hour %in% standard_hours_s) |
          (day_of_week == "U" & hour %in% standard_hours_u)
      ))
  ) %>%
  filter(facility_name != "Racquetball Court 5")


# 1. Create all combinations of hours, days, facilities
all_combinations <- expand.grid(
  facility_name = unique(attendance$facility_name),
  day_of_week = factor(days_of_week),
  hour = 0:23
)

# 2. Apply the open hour filter to all combinations
combination_schedule <- all_combinations %>%
  filter(
    # Logic for Pool Facilities
    (facility_name %in% pool_hours_facilities & (
      (day_of_week %in% c("M", "T", "W", "R", "F") & hour %in% pool_hours_m_f) |
        (day_of_week %in% c("S", "U") & hour %in% pool_hours_s_u)
    )) |
      # Logic for Climbing Center
      (facility_name %in% climb_center_facility & (
        (day_of_week %in% c("M", "T", "W", "R") & hour %in% climb_hours_m_r) |
          (day_of_week %in% c("F", "S", "U") & hour %in% climb_hours_f_u)
      )) |
      # Logic for Standard Facilities (all others)
      (!(facility_name %in% pool_hours_facilities | facility_name %in% climb_center_facility) & (
        (day_of_week %in% c("M", "T", "W", "R") & hour %in% standard_hours_m_r) |
          (day_of_week == "F" & hour %in% standard_hours_f) |
          (day_of_week == "S" & hour %in% standard_hours_s) |
          (day_of_week == "U" & hour %in% standard_hours_u)
      ))
  ) %>%
  filter(facility_name != "Racquetball Court 5") %>%
  # Also: Join the total capacities to the combination schedule so we can use then to calculate percentage later.
  left_join(facility_capacities, by = "facility_name")

#3. Join the combination schedule to the attendance dataset
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

# Fill NA timestamps with synthetic values built from anchor date + day + hour
attendance <- attendance %>%
  mutate(timestamp = if_else(
    is.na(timestamp),
    anchor_date + days(match(day_of_week, days_of_week) - 1) + hours(hour),
    timestamp
  ))

# Update the sorting to account for the synthetic timestamps
attendance <- attendance %>%
  arrange(timestamp)



# Training/testing split/folds

attendance_split_ts <- attendance %>%
  arrange(timestamp) %>%
  time_series_split(
    date_var   = timestamp,
    assess     = "1 week",   # hold out the last 1 week as test set
    cumulative = TRUE        # use all prior data for training
  )

train_data_ts <- training(attendance_split_ts)
test_data_ts  <- testing(attendance_split_ts)

ts_folds <- time_series_cv(
  data       = train_data_ts,
  date_var   = timestamp,
  assess     = "1 week",   # each fold's assessment window
  initial    = "16 days",  # minimum training window per fold
  slice_limit = 4,         # number of folds
  cumulative = TRUE
)


attendance_recipe_ts <- recipe(
  current_count ~ hour + day_of_week + facility_name,
  data = train_data_ts
) %>%
  step_dummy(all_nominal_predictors()) %>%
  step_zv(all_predictors()) %>%
  step_normalize(all_numeric_predictors())



# Model setup (Only gonna do rf/boosted here)



# RANDOM FOREST
# Tuning mtry (number of predictors), trees, and min_n (number of minimum values in each node)
rf_model <- rand_forest(mtry = tune(), 
                        trees = tune(), 
                        min_n = tune()
) %>% 
  set_engine("ranger", importance = "impurity") %>%
  set_mode("regression")

# BOOSTED TREES
# Tuning trees, learn_rate (the learning rate), and min_n
boosted_model <- boost_tree(trees = tune(),
                            learn_rate = tune(),
                            min_n = tune()) %>%
  set_engine("xgboost") %>%
  set_mode("regression")


library(finetune)

# Combine workflows into a set
model_set <- 
  workflow_set(
    preproc = list(base_rec = attendance_recipe_ts),
    models = list(rf = rf_model, boosted = boosted_model)
  )

# Define a racing control object (this drops poor hyperparameter combos early)
race_ctrl <- control_race(
  save_pred = TRUE,
  parallel_over = "everything",
  save_workflow = TRUE,
  verbose = TRUE,       # Show general progress
  verbose_elim = TRUE   # Show which models are discarded during racing
)

# Run the racing search across all models in the set
# This replaces multiple tune_grid() calls
race_results <- model_set %>%
  workflow_map(
    "tune_race_anova",
    resamples = ts_folds,
    grid = 10, # Number of candidate models to try per type
    control = race_ctrl,
    metrics = metric_set(rmse, rsq)
  )

# Results & Best Model
autoplot(race_results)
best_results <- race_results %>% 
  extract_workflow_set_result("base_rec_boosted") %>% 
  select_best(metric = "rmse")







# 1. Rank models by RMSE and pull the ID of the #1 winner
model_rankings <- rank_results(race_results, rank_metric = "rmse", select_best = TRUE)
best_model_id  <- model_rankings$wflow_id[1]
best_model_type <- model_rankings$model[1]

print(paste("The winner is:", best_model_type, "with ID:", best_model_id))

# 2. Extract the best parameters for that specific winner
best_params <- race_results %>% 
  extract_workflow_set_result(best_model_id) %>% 
  select_best(metric = "rmse")

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