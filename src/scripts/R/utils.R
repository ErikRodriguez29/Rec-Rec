# Shared helpers for Training.R, Predictions.R, and EDA.R

OUTPUT_ROOT <- file.path("..", "..", "output")

output_path <- function(...) {
  file.path(OUTPUT_ROOT, ...)
}

ensure_output_dir <- function(...) {
  path <- output_path(...)
  if (!dir.exists(path)) {
    dir.create(path, recursive = TRUE)
  }
  path
}

DAYS_OF_WEEK <- c("M", "T", "W", "R", "F", "S", "U")

POOL_HOURS_FACILITIES <- c(
  "Small Pool",
  "Big Pool",
  "Spa",
  "Pool Deck"
)

CLIMB_CENTER_FACILITY <- c("Climbing Center - MAC")

STANDARD_HOURS_M_R <- 6:22
STANDARD_HOURS_F <- 6:20
STANDARD_HOURS_S <- 9:20
STANDARD_HOURS_U <- 9:20

POOL_HOURS_M_F <- 6:19
POOL_HOURS_S_U <- 9:19

CLIMB_HOURS_M_R <- 11:21
CLIMB_HOURS_F_U <- 11:20

FACILITY_TYPE_LEVELS <- c(
  "court",
  "gym_court",
  "outdoor",
  "climbing",
  "functional_training",
  "spa",
  "other"
)


default_start_date <- function() {
  as.Date(Sys.getenv("START_DATE", unset = "2026-01-26"))
}

get_week_info <- function(
  week1_start = default_start_date(),
  today_date = Sys.Date()
) {
  current_monday <- today_date -
    lubridate::wday(today_date, week_start = 1) + 1
  week1_monday <- week1_start -
    lubridate::wday(week1_start, week_start = 1) + 1
  current_week <- as.integer(
    difftime(current_monday, week1_monday, units = "weeks")
  ) + 1

  list(
    week1_start = week1_start,
    today_date = today_date,
    current_monday = current_monday,
    week1_monday = week1_monday,
    current_week = current_week,
    next_week = current_week + 1L,
    next_monday = current_monday + lubridate::weeks(1)
  )
}


read_facility_counts <- function(path) {
  readr::read_csv(
    path,
    na = c("N/A", ""),
    col_types = readr::cols(
      facility_name = readr::col_character(),
      current_count = readr::col_double(),
      total_capacity = readr::col_double(),
      percentage_filled = readr::col_double(),
      timestamp = readr::col_character(),
      day_of_week = readr::col_integer(),
      is_raining = readr::col_logical()
    ),
    show_col_types = FALSE
  )
}


parse_attendance_timestamps <- function(
  df,
  days_of_week = DAYS_OF_WEEK
) {
  df %>%
    dplyr::mutate(
      timestamp = lubridate::ymd_hms(timestamp),
      hour = lubridate::hour(timestamp),
      day_of_week = factor(
        day_of_week,
        levels = 0:6,
        labels = days_of_week
      ),
      facility_name = factor(facility_name)
    ) %>%
    dplyr::arrange(facility_name, timestamp)
}


filter_to_open_hours <- function(df) {
  df %>%
    dplyr::filter(facility_name != "Racquetball Court 5") %>%
    dplyr::filter(
      (facility_name %in% POOL_HOURS_FACILITIES & (
        (day_of_week %in% c("M", "T", "W", "R", "F") & hour %in% POOL_HOURS_M_F) |
          (day_of_week %in% c("S", "U") & hour %in% POOL_HOURS_S_U)
      )) |
        (facility_name %in% CLIMB_CENTER_FACILITY & (
          (day_of_week %in% c("M", "T", "W", "R") & hour %in% CLIMB_HOURS_M_R) |
            (day_of_week %in% c("F", "S", "U") & hour %in% CLIMB_HOURS_F_U)
        )) |
        (!(facility_name %in% POOL_HOURS_FACILITIES |
          facility_name %in% CLIMB_CENTER_FACILITY) & (
          (day_of_week %in% c("M", "T", "W", "R") & hour %in% STANDARD_HOURS_M_R) |
            (day_of_week == "F" & hour %in% STANDARD_HOURS_F) |
            (day_of_week == "S" & hour %in% STANDARD_HOURS_S) |
            (day_of_week == "U" & hour %in% STANDARD_HOURS_U)
        ))
    ) %>%
    dplyr::filter(facility_name != "Racquetball Court 5")
}


assign_facility_type <- function(df) {
  fn <- as.character(df$facility_name)
  df %>%
    dplyr::mutate(
      facility_type = factor(
        dplyr::case_when(
          grepl("Racquetball|Squash", fn) ~ "court",
          grepl("Gym Court|Pavilion", fn) ~ "gym_court",
          grepl("Outdoor Fitness|Pool", fn) ~ "outdoor",
          grepl("Climbing", fn) ~ "climbing",
          grepl("FC|MAC", fn) ~ "functional_training",
          grepl("Spa", fn) ~ "spa",
          TRUE ~ "other"
        ),
        levels = FACILITY_TYPE_LEVELS
      )
    )
}


add_panel_lag_features <- function(df) {
  df %>%
    dplyr::arrange(facility_name, timestamp) %>%
    dplyr::group_by(facility_name, day_of_week, hour) %>%
    dplyr::mutate(
      lag_1w = dplyr::lag(current_count, 1L),
      roll_4w = slider::slide_dbl(
        current_count,
        mean,
        .before = 3,
        .complete = TRUE
      )
    ) %>%
    dplyr::ungroup() %>%
    dplyr::group_by(facility_name, day_of_week, hour) %>%
    dplyr::mutate(
      lag_1w = dplyr::if_else(
        is.na(lag_1w),
        median(lag_1w, na.rm = TRUE),
        lag_1w
      ),
      roll_4w = dplyr::if_else(
        is.na(roll_4w),
        median(roll_4w, na.rm = TRUE),
        roll_4w
      )
    ) %>%
    dplyr::ungroup() %>%
    dplyr::arrange(timestamp)
}


build_attendance_history <- function(
  attendance_raw,
  days_of_week = DAYS_OF_WEEK
) {
  observed <- attendance_raw %>%
    parse_attendance_timestamps(days_of_week = days_of_week) %>%
    filter_to_open_hours() %>%
    dplyr::mutate(
      week_start = lubridate::floor_date(
        as.Date(timestamp),
        "week",
        week_start = 1
      )
    ) %>%
    dplyr::group_by(facility_name, day_of_week, hour, week_start) %>%
    dplyr::summarize(
      current_count = median(current_count, na.rm = TRUE),
      .groups = "drop"
    )

  slots <- expand.grid(
    facility_name = unique(attendance_raw$facility_name),
    day_of_week = factor(days_of_week),
    hour = 0:23
  ) %>%
    filter_to_open_hours()

  week_range <- seq(
    min(observed$week_start),
    max(observed$week_start),
    by = "1 week"
  )

  tidyr::crossing(slots, week_start = week_range) %>%
    dplyr::left_join(
      observed,
      by = c("facility_name", "day_of_week", "hour", "week_start")
    ) %>%
    dplyr::group_by(facility_name, day_of_week, hour) %>%
    dplyr::mutate(
      current_count = dplyr::if_else(
        is.na(current_count),
        median(current_count, na.rm = TRUE),
        current_count
      )
    ) %>%
    dplyr::ungroup() %>%
    dplyr::group_by(facility_name) %>%
    dplyr::mutate(
      current_count = dplyr::if_else(
        is.na(current_count),
        median(current_count, na.rm = TRUE),
        current_count
      )
    ) %>%
    dplyr::ungroup() %>%
    dplyr::arrange(facility_name, day_of_week, hour, week_start) %>%
    dplyr::group_by(facility_name, day_of_week, hour) %>%
    dplyr::mutate(
      lag_1w = dplyr::lag(current_count, 1L),
      roll_4w = slider::slide_dbl(
        current_count,
        mean,
        .before = 3,
        .complete = TRUE
      )
    ) %>%
    dplyr::ungroup() %>%
    dplyr::group_by(facility_name, day_of_week, hour) %>%
    dplyr::mutate(
      lag_1w = dplyr::if_else(
        is.na(lag_1w),
        median(lag_1w, na.rm = TRUE),
        lag_1w
      ),
      roll_4w = dplyr::if_else(
        is.na(roll_4w),
        median(roll_4w, na.rm = TRUE),
        roll_4w
      )
    ) %>%
    dplyr::ungroup() %>%
    dplyr::mutate(
      timestamp = lubridate::as_datetime(week_start) +
        lubridate::days(match(day_of_week, days_of_week) - 1) +
        lubridate::hours(hour)
    )
}


build_slot_lag_medians <- function(history) {
  history %>%
    dplyr::group_by(facility_name, day_of_week, hour) %>%
    dplyr::summarize(
      lag_1w_med = median(lag_1w, na.rm = TRUE),
      roll_4w_med = median(roll_4w, na.rm = TRUE),
      count_med = median(current_count, na.rm = TRUE),
      .groups = "drop"
    ) %>%
    dplyr::mutate(
      lag_1w_med = dplyr::coalesce(lag_1w_med, count_med),
      roll_4w_med = dplyr::coalesce(roll_4w_med, lag_1w_med, count_med)
    ) %>%
    dplyr::select(-count_med)
}


lag_lookup_for_week <- function(history, ref_week) {
  ref_week <- as.Date(ref_week)
  history %>%
    dplyr::filter(week_start <= ref_week) %>%
    dplyr::arrange(facility_name, day_of_week, hour, timestamp) %>%
    dplyr::group_by(facility_name, day_of_week, hour) %>%
    dplyr::slice_tail(n = 1) %>%
    dplyr::ungroup() %>%
    dplyr::transmute(
      facility_name = as.character(facility_name),
      day_of_week,
      hour,
      lag_1w = lag_1w,
      roll_4w = roll_4w
    )
}


join_slot_lags <- function(
  pred_data,
  history,
  slot_lag_medians,
  days_of_week = DAYS_OF_WEEK
) {
  pred_data %>%
    dplyr::mutate(
      facility_name = as.character(facility_name),
      day_of_week = factor(day_of_week, levels = days_of_week),
      ref_week = lubridate::floor_date(
        as.Date(format(timestamp, "%Y-%m-%d", tz = "America/Los_Angeles")),
        "week",
        week_start = 1
      ) - lubridate::weeks(1)
    ) %>%
    dplyr::left_join(
      purrr::map_dfr(unique(.$ref_week), function(rw) {
        lag_lookup_for_week(history, rw) %>% dplyr::mutate(ref_week = rw)
      }),
      by = c("facility_name", "day_of_week", "hour", "ref_week")
    ) %>%
    dplyr::left_join(
      slot_lag_medians,
      by = c("facility_name", "day_of_week", "hour")
    ) %>%
    dplyr::mutate(
      lag_1w = dplyr::coalesce(lag_1w, lag_1w_med),
      roll_4w = dplyr::coalesce(roll_4w, roll_4w_med, lag_1w)
    ) %>%
    dplyr::select(-ref_week, -lag_1w_med, -roll_4w_med)
}
