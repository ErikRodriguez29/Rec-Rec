library(tidyverse)
library(tidymodels)
library(lubridate)
library(skimr)
library(shadowtext)

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
# AUTO WEEK DIRECTORY HANDLING
# ==============================

week_number <- get_week_info()$current_week

# Build directory path
save_path <- file.path("..", "EDA", paste0("Week ", week_number))

# Create directory if it doesn't exist
if (!dir.exists(save_path)) {
  dir.create(save_path, recursive = TRUE)
}

can_save <- TRUE


attendance_raw <- read_csv("../data/facility_counts.csv", na = c("N/A"))
attendance_cleaned <- na.omit(attendance_raw)
attendance <- attendance_cleaned %>%
  mutate(
    timestamp = ymd_hms(timestamp),
    hour = hour(timestamp),
    day_of_week = factor(day_of_week, levels = 0:6, labels = DAYS_OF_WEEK),
    facility_name = factor(facility_name)
  ) %>%
  arrange(facility_name, timestamp)
skim(attendance)

# 1 Average fullness of all Facilities
attendance %>%
  group_by(day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(aes(x = hour, y = day_of_week, fill = avg_pct, label = paste(signif(avg_pct, 2), "%", sep = ""))) +
  geom_tile(color = "gray") +
  geom_shadowtext(bg.colour = "white", color = "black", size = 4, bg.r = 0.08) +
  scale_fill_gradient2(low = "darkgreen", mid = "yellow", high = "darkred", midpoint = 50, limits = c(0, 100)) +
  labs(
    title = "Weekly Occupancy Pattern (All Facilities)",
    x = "Hour of Day",
    y = "Day of Week"
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank(),
    axis.text.x = element_text(angle = 0),
  )

if (can_save) {
  ggsave(filename = "1Mean Weekly Occupancy.png", path = save_path, width = 11, height = 8)
}

# 2 Fullness visualization of all facilities
attendance %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(aes(x = hour, y = day_of_week, fill = avg_pct)) +
  geom_tile(color = "gray") +
  scale_fill_gradient2(low = "darkgreen", mid = "yellow", high = "darkred", midpoint = 50, limits = c(0, 100)) +
  facet_wrap(~facility_name) +
  labs(
    title = "Weekly Occupancy by Facility",
    x = "Hour of Day",
    y = "Day of Week"
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank(),
    strip.text = element_text(face = "bold")
  )

if (can_save) {
  ggsave(filename = "2Weekly Occupancy (All Facilities).png", path = save_path, width = 16, height = 11)
}

# 3 Average fullness of most frequented places
# This includes all fitness centers, the MAC Court, and the Main Gym Courts
values_to_include <- c("FC 1 - South Room", "FC 1- North Room", "FC 2 - 1st floor", "FC 2- Mezzanine", "FC 3 - MAC", "MAC Court", "Main Gym Court 1 (North)", "Main Gym Court 2 (South)")
filtered_attendance <- attendance[(attendance$facility_name %in% values_to_include), ]
filtered_attendance %>%
  group_by(day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  ) %>%
  ggplot(aes(x = hour, y = day_of_week, fill = avg_pct, label = paste(signif(avg_pct, 2), "%", sep = ""))) +
  geom_tile(color = "gray") +
  geom_shadowtext(bg.colour = "white", color = "black", size = 4, bg.r = 0.065) +
  scale_fill_gradient2(low = "darkgreen", mid = "yellow", high = "darkred", midpoint = 50, limits = c(0, 100)) +
  labs(
    title = "Frequented Facilities Mean Weekly Occupancy (FCs, MAC, Main Gym Courts)",
    x = "Hour of Day",
    y = "Day of Week"
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank(),
    axis.text.x = element_text(angle = 0),
  )

if (can_save) {
  ggsave(filename = "3Mean Weekly Occupancy Frequented.png", path = save_path, width = 11, height = 8)
}


# 4 Fullness of frequented facilities
filtered_attendance %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(avg_pct = mean(percentage_filled), .groups = "drop") %>%
  ggplot(aes(x = hour, y = day_of_week, fill = avg_pct)) +
  geom_tile(color = "gray") +
  scale_fill_gradient2(low = "darkgreen", mid = "yellow", high = "darkred", midpoint = 50, limits = c(0, 100)) +
  facet_wrap(~facility_name) +
  labs(title = "Frequented Facilities Weekly Occupancy (FCs, MAC, Main Gym Courts)", x = "Hour of Day", y = "Day of Week") +
  theme_minimal() +
  theme(
    panel.grid = element_blank(),
    strip.text = element_text(face = "bold")
  )

if (can_save) {
  ggsave(filename = "4Weekly Occupancy Frequented Tiles.png", path = save_path, width = 11, height = 8)
}

# 5 Normalized mean fullness of all Facilities (normalized by the maximum percentage observed)
max_mean_all <- attendance %>%
  group_by(day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  summarize(max(avg_pct)) %>%
  pull()

attendance %>%
  group_by(day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  mutate(avg_norm = avg_pct / max_mean_all) %>%
  ggplot(aes(
    x = hour,
    y = day_of_week,
    fill = avg_norm,
    label = signif(avg_norm, 2)
  )) +
  geom_tile(color = "gray") +
  geom_shadowtext(
    bg.colour = "white",
    color = "black",
    size = 4,
    bg.r = 0.08
  ) +
  scale_fill_gradient2(
    low = "darkgreen",
    mid = "yellow",
    high = "darkred",
    midpoint = 0.5,
    limits = c(0, 1)
  ) +
  labs(
    title = "Weekly Occupancy Pattern Normalized by Max Mean (All Facilities)",
    x = "Hour of Day",
    y = "Day of Week"
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank(),
    axis.text.x = element_text(angle = 0)
  )

if (can_save) {
  ggsave(filename = "5Mean Weekly Occupancy Normalized.png", path = save_path, width = 11, height = 8)
}

max_mean_frequented <- filtered_attendance %>%
  group_by(day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  summarize(max(avg_pct)) %>%
  pull()

# 6 Normalized mean fullness of frequented places
filtered_attendance %>%
  group_by(day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  mutate(avg_norm = avg_pct / max_mean_frequented) %>%
  ggplot(aes(
    x = hour,
    y = day_of_week,
    fill = avg_norm,
    label = signif(avg_norm, 2)
  )) +
  geom_tile(color = "gray") +
  geom_shadowtext(
    bg.colour = "white",
    color = "black",
    size = 4,
    bg.r = 0.08
  ) +
  scale_fill_gradient2(
    low = "darkgreen",
    mid = "yellow",
    high = "darkred",
    midpoint = 0.5,
    limits = c(0, 1)
  ) +
  labs(
    title = "Frequented Facilities Mean Weekly Occupancy Normalized by Max Mean",
    x = "Hour of Day",
    y = "Day of Week"
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank(),
    axis.text.x = element_text(angle = 0)
  )

if (can_save) {
  ggsave(filename = "6Mean Weekly Occupancy Frequented Normalized.png", path = save_path, width = 11, height = 8)
}

# 7 Normalized fullness of all facilities


facility_means <- attendance %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(
    avg_pct = mean(percentage_filled),
    .groups = "drop"
  )

facility_max_means <- facility_means %>%
  group_by(facility_name) %>%
  summarize(
    max_mean_pct = max(avg_pct),
    .groups = "drop"
  )

attendance %>%
  left_join(facility_max_means, by = "facility_name") %>%
  mutate(norm_pct = percentage_filled / max_mean_pct) %>%
  ungroup() %>%
  group_by(facility_name, day_of_week, hour) %>%
  summarize(
    avg_norm = mean(norm_pct),
    .groups = "drop"
  ) %>%
  ggplot(aes(hour, day_of_week, fill = avg_norm)) +
  geom_tile(color = "gray") +
  scale_fill_gradient2(low = "darkgreen", mid = "yellow", high = "darkred", midpoint = 0.5, limits = c(0, 1)) +
  facet_wrap(~facility_name) +
  labs(
    title = "Weekly Occupancy Pattern (Normalized by Max of each Facility)"
  ) +
  theme_minimal() +
  theme(
    panel.grid = element_blank(),
    strip.text = element_text(face = "bold")
  )

if (can_save) {
  ggsave(filename = "7Weekly Occupancy Normalized.png", path = save_path, width = 16.2, height = 11)
}

print("DONE")
print(paste("Saved plots to:", save_path))
