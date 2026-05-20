library(tidyverse)
library(tidymodels)
library(lubridate)

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

# ==============================
# WEEK HANDLING
# ==============================

week_info <- get_week_info()
current_week <- week_info$current_week
current_monday <- week_info$current_monday
next_week <- week_info$next_week
next_monday <- week_info$next_monday

print(paste(
  "Current week:", current_week
))

print(paste(
  "Predicting Week:", next_week
))

# ==============================
# LOAD LATEST AVAILABLE MODEL
# ==============================

model_root <- output_path("tuned_models")

model_dirs <- list.dirs(
  model_root,
  recursive = FALSE,
  full.names = FALSE
)

# Extract week numbers safely
week_numbers <- as.numeric(
  gsub("Week ", "", model_dirs)
)

# Handle empty directory case
if (length(week_numbers) == 0 ||
  all(is.na(week_numbers))) {
  stop(
    "No trained models found in ", model_root, ".
     Run Training.R first."
  )
}

latest_week <- max(week_numbers)

model_path <- file.path(
  model_root,
  paste0("Week ", latest_week),
  "final_attendance_workflow.rds"
)

rf_final_fit_train_ts <- readRDS(model_path)

print(paste(
  "Loaded model from Week",
  latest_week
))


# ==============================
# LOAD TRAINING DATA STRUCTURE
# (needed to rebuild schedule)
# ==============================

attendance_raw <- read_facility_counts("../../data/facility_counts.csv")

days_of_week <- c("M", "T", "W", "R", "F", "S", "U")


# ==============================
# PREDICTION SAVE DIRECTORY
# ==============================

save_path <- file.path(
  ensure_output_dir("predictions", paste0("Week ", next_week)),
  ""
)

# ------------------------------
# Rebuild facility schedule
# ------------------------------

facility_capacities <- attendance_raw %>%
  distinct(facility_name, total_capacity)


# ==============================
# BUILD COMBINATION SCHEDULE
# ==============================

all_combinations <- expand.grid(
  facility_name = unique(attendance_raw$facility_name),
  day_of_week = factor(days_of_week),
  hour = 0:23
)

combination_schedule <- all_combinations %>%
  filter_to_open_hours() %>%
  left_join(
    facility_capacities,
    by = "facility_name"
  )


# ==============================
# Account for lag features in training data
# ==============================

attendance_history <- build_attendance_history(attendance_raw, days_of_week)
slot_lag_medians <- build_slot_lag_medians(attendance_history)


# ==============================
# BUILD NEXT-WEEK TIMESTAMPS
# ==============================

# Ensure the correct timezone is used for proper hour calculations in
# predictions dataset
next_monday_dt <- as_datetime(next_monday, tz = "America/Los_Angeles")

forecast_data <- combination_schedule %>%
  mutate(
    timestamp =
      next_monday_dt +
        days(match(day_of_week, days_of_week) - 1) +
        hours(hour),
    facility_name = factor(facility_name),
    day_of_week = factor(day_of_week, levels = days_of_week)
  )
# ==============================
# BUILD CURRENT-WEEK TIMESTAMPS
# ==============================

current_monday_dt <- as_datetime(current_monday, tz = "America/Los_Angeles")

current_week_data <- combination_schedule %>%
  mutate(
    timestamp =
      current_monday_dt +
        days(match(day_of_week, days_of_week) - 1) +
        hours(hour),
    facility_name = factor(facility_name),
    day_of_week = factor(day_of_week, levels = days_of_week)
  )

# ==============================
# CURRENT WEEK WEATHER
# ==============================
library(httr2)
library(fs)

current_forecast_start <- as.Date(current_monday)
current_forecast_end <- current_forecast_start + days(6)

current_cache_file <- paste0(
  "../../data/weather_data/cached_weather_week_",
  current_week,
  ".rds"
)

if (file_exists(current_cache_file)) {
  message(paste0(
    "Using cached weather data from Week ",
    current_week
  ))

  current_weather_data <- readRDS(current_cache_file)
} else {
  req <- request("https://api.open-meteo.com/v1/forecast") %>%
    req_url_query(
      latitude = 34.4140,
      longitude = -119.8489,
      hourly = "weather_code",
      start_date = as.character(current_forecast_start),
      end_date = as.character(current_forecast_end),
      timezone = "auto"
    )

  resp <- req %>%
    req_perform() %>%
    resp_body_json()

  current_weather_data <- tibble(
    datetime = ymd_hm(unlist(resp$hourly$time)),
    w_code = unlist(resp$hourly$weather_code)
  )

  saveRDS(
    current_weather_data,
    current_cache_file
  )
}

current_week_data <- current_week_data %>%
  mutate(
    timestamp =
      with_tz(
        timestamp,
        tzone = "America/Los_Angeles"
      )
  ) %>%
  left_join(
    current_weather_data,
    by = c("timestamp" = "datetime")
  ) %>%
  mutate(
    is_raining =
      replace_na(w_code, 0) >= 51,
    is_raining =
      factor(is_raining, levels = c(FALSE, TRUE))
  ) %>%
  select(-w_code)


# ==============================
# NEXT WEEK WEATHER
# ==============================

# Augment true forecast rain values from the open meteo API

forecast_start <- as.Date(next_monday)
forecast_end <- forecast_start + days(6)

# Save the weather into a cache file so that we don't have to make API calls
# for an already existing week
weather_dir <- "../../data/weather_data"

if (!dir.exists(weather_dir)) {
  dir.create(weather_dir, recursive = TRUE)
}

cache_file <- paste0("../../data/weather_data/cached_weather_week_", next_week, ".rds")

if (file_exists(cache_file)) {
  # Load existing data if it exists
  message(paste0("Using cached weather data from Week ", next_week))
  weather_data <- readRDS(cache_file)
} else {
  # Fetch weather data for UCSB (located 34.4140, -119.8489)
  forecast_start <- as.Date(next_monday)
  forecast_end <- forecast_start + days(6)

  req <- request("https://api.open-meteo.com/v1/forecast") %>%
    req_url_query(
      latitude = 34.4140,
      longitude = -119.8489,
      hourly = "weather_code",
      start_date = as.character(forecast_start),
      end_date = as.character(forecast_end),
      timezone = "auto"
    )

  # Perform request and parse JSON
  resp <- req %>%
    req_perform() %>%
    resp_body_json()

  # Convert JSON arrays into a tidy data frame
  weather_data <- tibble(
    datetime = ymd_hm(unlist(resp$hourly$time)),
    w_code = unlist(resp$hourly$weather_code)
  )

  saveRDS(weather_data, cache_file)
}


# Augment to forecast_data
forecast_data <- forecast_data %>%
  mutate(timestamp = with_tz(timestamp, tzone = "America/Los_Angeles")) %>%
  left_join(weather_data, by = c("timestamp" = "datetime")) %>%
  mutate(
    # Weather code >= 51 includes all types of rain/snow
    is_raining = replace_na(w_code, 0) >= 51,
    is_raining = factor(is_raining, levels = c(FALSE, TRUE))
  ) %>%
  select(-w_code)

# Add lag columns to account for the trained workflow (prior-week median per slot)
join_slot_lags <- function(pred_data, week_start_dt) {
  lag_lookup <- attendance_raw %>%
    mutate(
      timestamp = ymd_hms(timestamp),
      hour = hour(timestamp),
      day_of_week = factor(day_of_week, levels = 0:6, labels = days_of_week)
    ) %>%
    filter(
      timestamp >= week_start_dt - weeks(1),
      timestamp < week_start_dt
    ) %>%
    group_by(facility_name, day_of_week, hour) %>%
    summarize(
      lag_1w = median(current_count, na.rm = TRUE),
      roll_4w = median(current_count, na.rm = TRUE),
      .groups = "drop"
    )

  pred_data %>%
    left_join(lag_lookup, by = c("facility_name", "day_of_week", "hour")) %>%
    mutate(
      lag_1w = coalesce(lag_1w, median(lag_1w, na.rm = TRUE)),
      roll_4w = coalesce(roll_4w, median(roll_4w, na.rm = TRUE))
    )
}

current_week_data <- join_slot_lags(current_week_data, current_monday_dt)
forecast_data <- join_slot_lags(forecast_data, next_monday_dt)

# ==============================
# EXERCISE CATEGORIES
# ==============================
# Adds two columns to the predictions, a list of exercise categories and
# a list of activities corresponding to each category, describing what
# machines/exercises achieve each. Each category, activity list pair is
# unique to each facility.
exercise_categories <- tribble(
  ~facility_name, ~categories, ~activities,
  "Racquetball Court 1", c("cardio"), c("racquetball"),
  "Racquetball Court 2", c("cardio"), c("racquetball"),
  "Racquetball Court 3", c("cardio"), c("racquetball"),
  "Racquetball Court 4", c("cardio"), c("racquetball"),
  "Squash Court 1", c("cardio"), c("squash"),
  "Galleria", c("cardio", "legs"), c("ellipticals (precor branded machines)", "stairmasters (stair machines)", "treadmills"),
  "Main Gym Court 1 (North)", c("cardio"), c("basketball"),
  "Main Gym Court 2 (South)", c("cardio"), c("basketball"),
  "Outdoor Fitness 1 (Turf, Free Weights, Benches)", c("arms", "cardio", "core", "legs", "weight training"), c("benching", "bike machines", "weight lifting"),
  "Pavilion Court 1 (West)", c("cardio"), c("badminton"),
  "Pavilion Court 2 (East)", c("cardio"), c("badminton"),
  "Outdoor Fitness 2 (Behind Pottery)", c("cardio"), c("bike machines", "ellipticals (precor branded machines)"),
  "FC 1- North Room", c("arms", "core", "legs", "weight training"), c("arm machines", "core machines", "leg presses", "weight lifting"),
  "FC 1 - South Room", c("arms", "core", "legs", "weight training"), c("arm machines", "core machines", "leg presses", "weight lifting"),
  "FC 2 - 1st floor", c("cardio", "core", "legs", "weight training"), c("arm & leg machines", "stairmasters (stair machines)", "treadmills", "weight crunch machines", "weight lifting"),
  "FC 2- Mezzanine", c("cardio", "legs"), c("ellipticals (precor branded machines)", "treadmills"),
  "FC 3 - MAC", c("arms", "cardio", "core", "legs", "weight training"), c("arm machines", "leg presses", "treadmills", "weight crunch machines", "weight lifting"),
  "MAC Court", c("NA"), c("hockey", "skating"), # Idk why this is included in facility counts lol
  "Spa", c("NA"), c("NA"), # Same with this bruh
  "Small Pool", c("cardio"), c("swimming"),
  "Big Pool", c("cardio"), c("swimming"),
  "Pool Deck", c("NA"), c("NA"), # Or this
  "Climbing Center - MAC", c("NA"), c("climbing")
)

exercise_categories <- exercise_categories %>%
  mutate(
    facility_name = str_trim(facility_name)
  )

# ==============================
# CURRENT WEEK PREDICTIONS
# ==============================
current_predictions <-
  predict(
    rf_final_fit_train_ts,
    new_data = current_week_data
  ) %>%
  bind_cols(current_week_data) %>%
  mutate(
    predicted_count =
      pmax(0, round(.pred)),
    percentage_filled =
      (predicted_count /
        total_capacity) * 100,
    timestamp =
      format(
        timestamp,
        "%Y-%m-%d %H:%M:%S"
      ),
    is_raining =
      as.logical(as.character(is_raining))
  ) %>%
  select(-.pred) %>%
  left_join(exercise_categories, by = "facility_name") %>%
  mutate(
    # We want to augment a new column is_outdoor_facility which describes whether the
    # facility is outdoors (this includes the outdoor fitness courts and the pool facilities).
    # These will have infinite weights when is_raining is true at the corresponding row.
    is_outdoor_facility = case_when(
      facility_name == "Outdoor Fitness 1" ~ TRUE,
      facility_name == "Outdoor Fitness 2" ~ TRUE,
      facility_name == "Spa" ~ TRUE,
      facility_name == "Small Pool" ~ TRUE,
      facility_name == "Big Pool" ~ TRUE,
      facility_name == "Pool Deck" ~ TRUE,
      TRUE ~ FALSE
    ),
    categories = map_chr(categories, paste, collapse = "; "),
    activities = map_chr(activities, paste, collapse = "; ")
  )

# ==============================
# NEXT WEEK PREDICTIONS
# ==============================

forecast_predictions <-
  predict(
    rf_final_fit_train_ts,
    new_data = forecast_data
  ) %>%
  bind_cols(forecast_data) %>%
  mutate(
    predicted_count =
      pmax(0, round(.pred)),
    percentage_filled =
      (predicted_count /
        total_capacity) * 100,

    # FORMAT TIMESTAMP
    timestamp = format(timestamp, "%Y-%m-%d %H:%M:%S"),
    is_raining = as.logical(as.character(is_raining))
  ) %>%
  select(-.pred) %>%
  left_join(exercise_categories, by = "facility_name") %>%
  mutate(
    # We want to augment a new column is_outdoor_facility which describes whether the
    # facility is outdoors (this includes the outdoor fitness courts and the pool facilities).
    # These will have infinite weights when is_raining is true at the corresponding row.
    is_outdoor_facility = case_when(
      facility_name == "Outdoor Fitness 1" ~ TRUE,
      facility_name == "Outdoor Fitness 2" ~ TRUE,
      facility_name == "Spa" ~ TRUE,
      facility_name == "Small Pool" ~ TRUE,
      facility_name == "Big Pool" ~ TRUE,
      facility_name == "Pool Deck" ~ TRUE,
      TRUE ~ FALSE
    ),
    categories = map_chr(categories, paste, collapse = "; "),
    activities = map_chr(activities, paste, collapse = "; ")
  )


# ==============================
# MAIN FACILITY FORECAST PLOT
# ==============================

forecast_plot <-
  forecast_predictions %>%
  group_by(
    facility_name,
    day_of_week,
    hour
  ) %>%
  summarize(
    avg_pct =
      mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(
    aes(
      x = hour,
      y = day_of_week,
      fill = avg_pct
    )
  ) +
  geom_tile(color = "gray") +
  scale_fill_gradient2(
    low = "darkgreen",
    mid = "yellow",
    high = "darkred",
    midpoint = 50,
    limits = c(0, 100)
  ) +
  facet_wrap(~facility_name) +
  labs(
    title =
      paste(
        "Weekly Forecast — Week",
        next_week
      ),
    x = "Hour",
    y = "Day"
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank(),
    strip.text =
      element_text(face = "bold")
  )

ggsave(
  filename =
    "1All Facilities Forecast.png",
  plot = forecast_plot,
  path = save_path,
  width = 16,
  height = 11
)

write_csv(
  forecast_predictions %>%
    mutate(
      percentage_filled =
        sprintf("%.2f", percentage_filled)
    ),
  paste0(
    save_path,
    "forecast_values.csv"
  )
)

# ==============================
# SAVE CURRENT WEEK CSV ONLY
# ==============================

current_save_path <- file.path(
  ensure_output_dir("predictions", paste0("Week ", current_week)),
  ""
)

write_csv(
  current_predictions %>%
    mutate(
      percentage_filled =
        sprintf("%.2f", percentage_filled)
    ),
  paste0(
    current_save_path,
    "forecast_values.csv"
  )
)

# ==============================
# FACILITY CATEGORIES
# ==============================
# TODO: May want to do these visuals by exercise category, or some other useful grouping instead

facilities_to_include <- c(
  "FC 1 - South Room",
  "FC 1- North Room",
  "FC 2 - 1st floor",
  "FC 2- Mezzanine",
  "FC 3 - MAC",
  "MAC Court",
  "Main Gym Court 1 (North)",
  "Main Gym Court 2 (South)"
)

racquetball_facilities <- c(
  "Racquetball Court 1",
  "Racquetball Court 2",
  "Racquetball Court 3",
  "Racquetball Court 4",
  "Squash Court 1"
)

remaining_facilities <- c(
  "Outdoor Fitness 1",
  "Outdoor Fitness 2",
  "Galleria",
  "Pavilion Court 1 (West)",
  "Pavilion Court 2 (East)"
)

# ==============================
# CATEGORICAL FACILITIES PLOTS
# ==============================

frequented_plot <-
  forecast_predictions %>%
  filter(facility_name %in% facilities_to_include) %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(aes(hour, day_of_week, fill = avg_pct)) +
  geom_tile(color = "gray") +
  scale_fill_gradient2(
    low = "darkgreen",
    mid = "yellow",
    high = "darkred",
    midpoint = 50,
    limits = c(0, 100)
  ) +
  facet_wrap(~facility_name) +
  labs(
    title = paste(
      "Frequented Facilities Forecast — Week",
      next_week
    ),
    x = "Hour",
    y = "Day"
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank(),
    strip.text = element_text(face = "bold")
  )

ggsave(
  "2Frequented Facilities Forecast.png",
  frequented_plot,
  path = save_path,
  width = 16,
  height = 11
)




pool_plot <-
  forecast_predictions %>%
  filter(facility_name %in% POOL_HOURS_FACILITIES) %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(aes(hour, day_of_week, fill = avg_pct)) +
  geom_tile(color = "gray") +
  scale_fill_gradient2(
    low = "darkgreen",
    mid = "yellow",
    high = "darkred",
    midpoint = 50,
    limits = c(0, 100)
  ) +
  facet_wrap(~facility_name) +
  labs(
    title = paste(
      "Pool Facilities Forecast — Week",
      next_week
    )
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank(),
    strip.text = element_text(face = "bold")
  )

ggsave(
  "3Pool Facilities Forecast.png",
  pool_plot,
  path = save_path,
  width = 16,
  height = 11
)




climb_plot <-
  forecast_predictions %>%
  filter(facility_name %in% CLIMB_CENTER_FACILITY) %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(aes(hour, day_of_week, fill = avg_pct)) +
  geom_tile(color = "gray") +
  scale_fill_gradient2(
    low = "darkgreen",
    mid = "yellow",
    high = "darkred",
    midpoint = 50,
    limits = c(0, 100)
  ) +
  facet_wrap(~facility_name) +
  labs(
    title = paste(
      "Climbing Center Forecast — Week",
      next_week
    )
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank()
  )

ggsave(
  "4Climbing Center Forecast.png",
  climb_plot,
  path = save_path,
  width = 8,
  height = 6
)



racquetball_plot <-
  forecast_predictions %>%
  filter(facility_name %in% racquetball_facilities) %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(aes(hour, day_of_week, fill = avg_pct)) +
  geom_tile(color = "gray") +
  scale_fill_gradient2(
    low = "darkgreen",
    mid = "yellow",
    high = "darkred",
    midpoint = 50,
    limits = c(0, 100)
  ) +
  facet_wrap(~facility_name) +
  labs(
    title = paste(
      "Racquetball & Squash Forecast — Week",
      next_week
    )
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank()
  )

ggsave(
  "5Racquetball Forecast.png",
  racquetball_plot,
  path = save_path,
  width = 12,
  height = 8
)



remaining_plot <-
  forecast_predictions %>%
  filter(facility_name %in% remaining_facilities) %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(aes(hour, day_of_week, fill = avg_pct)) +
  geom_tile(color = "gray") +
  scale_fill_gradient2(
    low = "darkgreen",
    mid = "yellow",
    high = "darkred",
    midpoint = 50,
    limits = c(0, 100)
  ) +
  facet_wrap(~facility_name) +
  labs(
    title = paste(
      "Remaining Facilities Forecast — Week",
      next_week
    )
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank()
  )

ggsave(
  "6Remaining Facilities Forecast.png",
  remaining_plot,
  path = save_path,
  width = 12,
  height = 6
)

print("Predictions Complete")
print(paste("Saved predictions to:", save_path))
print(paste("Forecast week begins:", next_monday))
