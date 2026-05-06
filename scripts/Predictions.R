library(tidyverse)
library(tidymodels)
library(lubridate)

# ==============================
# WEEK HANDLING
#==============================

week1_start <- as.Date("2026-01-26")
today_date <- Sys.Date()

# Current Monday
current_monday <- today_date -
  lubridate::wday(today_date, week_start = 1) + 1

# Week 1 Monday
week1_monday <- week1_start -
  lubridate::wday(week1_start, week_start = 1) + 1

# Current week number
current_week <- as.integer(
  difftime(
    current_monday,
    week1_monday,
    units = "weeks"
  )
) + 1

# Next week
next_week <- current_week + 1
next_monday <- current_monday + weeks(1)

print(paste(
  "Current week:", current_week
))

print(paste(
  "Predicting Week:", next_week
))

# ==============================
# LOAD LATEST AVAILABLE MODEL
# ==============================

model_root <- "../tuned_models"

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
    "No trained models found in ../tuned_models/.
     Run Training.R first."
  )
  
}

latest_week <- max(week_numbers)

model_path <- paste0(
  "../tuned_models/Week ",
  latest_week,
  "/final_attendance_workflow.rds"
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

attendance_raw <- read_csv(
  "../data/facility_counts.csv"
)

days_of_week <- c("M","T","W","R","F","S","U")


# ==============================
# PREDICTION SAVE DIRECTORY
# ==============================

save_path <- paste0(
  "../predictions/Week ",
  next_week,
  "/"
)

if (!dir.exists(save_path)) {
  dir.create(save_path,
             recursive = TRUE)
}

# ------------------------------
# Rebuild facility schedule
# ------------------------------

facility_capacities <- attendance_raw %>%
  distinct(facility_name, total_capacity)


# ---- Define facility groups ----

pool_hours_facilities <- c(
  "Small Pool",
  "Big Pool",
  "Spa",
  "Pool Deck"
)

climb_center_facility <- c(
  "Climbing Center - MAC"
)


# ---- Hour definitions ----

standard_hours_m_r <- 6:22
standard_hours_f   <- 6:20
standard_hours_s   <- 9:20
standard_hours_u   <- 9:20

pool_hours_m_f <- 6:19
pool_hours_s_u <- 9:19

climb_hours_m_r <- 11:21
climb_hours_f_u <- 11:20


# ==============================
# BUILD COMBINATION SCHEDULE
# ==============================

all_combinations <- expand.grid(
  facility_name = unique(attendance_raw$facility_name),
  day_of_week = factor(days_of_week),
  hour = 0:23
)

combination_schedule <- all_combinations %>%
  filter(
    (facility_name %in% pool_hours_facilities & (
      (day_of_week %in% c("M","T","W","R","F") &
         hour %in% pool_hours_m_f) |
        (day_of_week %in% c("S","U") &
           hour %in% pool_hours_s_u)
    )) |
      
      (facility_name %in% climb_center_facility & (
        (day_of_week %in% c("M","T","W","R") &
           hour %in% climb_hours_m_r) |
          (day_of_week %in% c("F","S","U") &
             hour %in% climb_hours_f_u)
      )) |
      
      (!(facility_name %in%
           c(pool_hours_facilities,
             climb_center_facility)) & (
               
               (day_of_week %in% c("M","T","W","R") &
                  hour %in% standard_hours_m_r) |
                 
                 (day_of_week == "F" &
                    hour %in% standard_hours_f) |
                 
                 (day_of_week == "S" &
                    hour %in% standard_hours_s) |
                 
                 (day_of_week == "U" &
                    hour %in% standard_hours_u)
               
             ))
  ) %>%
  filter(facility_name != "Racquetball Court 5") %>%
  left_join(
    facility_capacities,
    by = "facility_name"
  )


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
current_forecast_end   <- current_forecast_start + days(6)

current_cache_file <- paste0(
  "../data/weather_data/cached_weather_week_",
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
forecast_end   <- forecast_start + days(6)

# Save the weather into a cache file so that we don't have to make API calls
# for an already existing week
weather_dir <- "../data/weather_data"

if (!dir.exists(weather_dir)) {
  dir.create(weather_dir, recursive = TRUE)
}

cache_file <- paste0("../data/weather_data/cached_weather_week_", next_week, ".rds")

if (file_exists(cache_file)) {
  # Load existing data if it exists
  message(paste0("Using cached weather data from Week ", next_week))
  weather_data <- readRDS(cache_file)
} else {
  # Fetch weather data for UCSB (located 34.4140, -119.8489)
  forecast_start <- as.Date(next_monday)
  forecast_end   <- forecast_start + days(6)
  
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
  "Galleria", c("cardio", "legs"), c("treadmills", "stairmasters (stair machines)", "ellipticals (precor branded machines)"),
  "Main Gym Court 1 (North)", c("cardio"), c("basketball"),
  "Main Gym Court 2 (South)", c("cardio"), c("basketball"),
  "Outdoor Fitness 1 (Turf, Free Weights, Benches)", c("weight training", "arms", "legs", "core", "cardio"), c("weight lifting", "benching", "bike machines"),
  "Pavilion Court 1 (West)", c("cardio"), c("badminton"),
  "Pavilion Court 2 (East)", c("cardio"), c("badminton"),
  "Outdoor Fitness 2 (Behind Pottery)", c("cardio"), c("ellipticals (precor branded machines)", "bike machines"),
  "FC 1- North Room", c("weight training", "arms", "legs", "core"), c("weight lifting", "arm machines", "leg presses", "core machines"),
  "FC 1 - South Room", c("weight training", "arms", "legs", "core"), c("weight lifting", "arm machines", "leg presses", "core machines"),
  "FC 2 - 1st floor", c("cardio", "weight training", "legs", "core"), c("weight lifting", "treadmills", "stairmasters", "weight crunch machines", "arm & leg machines"),
  "FC 2- Mezzanine", c("cardio", "legs"), c("treadmills", "ellipticals (precor branded machines)"),
  "FC 3 - MAC", c("cardio", "weight training", "arms", "legs", "core"), c("treadmills", "weight lifting", "arm machines", "leg presses", "weight crunch machines"),
  "MAC Court", c("NA"), c("hockey", "skating"), # Idk why this is included in facility counts lol
  "Spa", c("NA"), c("NA"),                      # Same with this bruh
  "Small Pool", c("cardio"), c("swimming"),
  "Big Pool", c("cardio"), c("swimming"),
  "Pool Deck", c("NA"), c("NA"),                # Or this
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
  geom_tile(color="gray") +
  scale_fill_gradient2(
    low="darkgreen",
    mid="yellow",
    high="darkred",
    midpoint=50,
    limits=c(0,100)
  ) +
  facet_wrap(~facility_name) +
  labs(
    title =
      paste(
        "Weekly Forecast — Week",
        next_week
      ),
    x="Hour",
    y="Day"
  ) +
  theme_minimal() +
  theme(
    panel.grid=element_blank(),
    strip.text=
      element_text(face="bold")
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

current_save_path <- paste0(
  "../predictions/Week ",
  current_week,
  "/"
)

if (!dir.exists(current_save_path)) {
  dir.create(
    current_save_path,
    recursive = TRUE
  )
}

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
    low="darkgreen",
    mid="yellow",
    high="darkred",
    midpoint=50,
    limits=c(0,100)
  ) +
  facet_wrap(~ facility_name) +
  labs(
    title = paste(
      "Frequented Facilities Forecast — Week",
      next_week
    ),
    x="Hour",
    y="Day"
  ) +
  theme_minimal() +
  theme(
    panel.grid=element_blank(),
    strip.text=element_text(face="bold")
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
  filter(facility_name %in% pool_hours_facilities) %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(aes(hour, day_of_week, fill = avg_pct)) +
  geom_tile(color="gray") +
  scale_fill_gradient2(
    low="darkgreen",
    mid="yellow",
    high="darkred",
    midpoint=50,
    limits=c(0,100)
  ) +
  facet_wrap(~ facility_name) +
  labs(
    title = paste(
      "Pool Facilities Forecast — Week",
      next_week
    )
  ) +
  theme_minimal() +
  theme(
    panel.grid=element_blank(),
    strip.text=element_text(face="bold")
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
  filter(facility_name %in% climb_center_facility) %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(aes(hour, day_of_week, fill = avg_pct)) +
  geom_tile(color="gray") +
  scale_fill_gradient2(
    low="darkgreen",
    mid="yellow",
    high="darkred",
    midpoint=50,
    limits=c(0,100)
  ) +
  facet_wrap(~ facility_name) +
  labs(
    title = paste(
      "Climbing Center Forecast — Week",
      next_week
    )
  ) +
  theme_minimal() +
  theme(
    panel.grid=element_blank()
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
  geom_tile(color="gray") +
  scale_fill_gradient2(
    low="darkgreen",
    mid="yellow",
    high="darkred",
    midpoint=50,
    limits=c(0,100)
  ) +
  facet_wrap(~ facility_name) +
  labs(
    title = paste(
      "Racquetball & Squash Forecast — Week",
      next_week
    )
  ) +
  theme_minimal() +
  theme(
    panel.grid=element_blank()
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
  geom_tile(color="gray") +
  scale_fill_gradient2(
    low="darkgreen",
    mid="yellow",
    high="darkred",
    midpoint=50,
    limits=c(0,100)
  ) +
  facet_wrap(~ facility_name) +
  labs(
    title = paste(
      "Remaining Facilities Forecast — Week",
      next_week
    )
  ) +
  theme_minimal() +
  theme(
    panel.grid=element_blank()
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