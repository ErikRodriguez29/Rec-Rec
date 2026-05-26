from datetime import date, timedelta
from pathlib import Path

OUTPUT_ROOT = "../../output"
PREDICTIONS_ROOT = f"{OUTPUT_ROOT}/predictions"
RECOMMENDATIONS_ROOT = f"{OUTPUT_ROOT}/recommendations"
RECOMMENDATIONS_JSON_PATH = f"{RECOMMENDATIONS_ROOT}/recommendations.json"
RECOMMENDATIONS_TXT_PATH = f"{RECOMMENDATIONS_ROOT}/recommendations.txt"


def predictions_week_path(week_number: int, filename: str) -> str:
    return f"{PREDICTIONS_ROOT}/Week {week_number}/{filename}"


def recommendations_week_path(week_number: int, filename: str = "recommendations.csv") -> str:
    return f"{RECOMMENDATIONS_ROOT}/Week {week_number}/{filename}"


def ensure_parent_dir(path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)


# Whether to use hard coded load paths for the current and next week numbers
use_hard_coded_load_paths = False
current_week_load_path = predictions_week_path(16, "forecast_values.csv")
next_week_load_path = predictions_week_path(17, "forecast_values.csv")
# Whether to use hard coded save paths for the current and next week numbers
use_hard_coded_save_paths = False
current_week_save_path = recommendations_week_path(16, "forecast_values_filtered.csv")
next_week_save_path = recommendations_week_path(17, "forecast_values_filtered.csv")
# Whether to use hard coded save paths for recommendation CSV output
use_hard_coded_recommendations_save_paths = False
current_week_recommendations_save_path = recommendations_week_path(16)
next_week_recommendations_save_path = recommendations_week_path(17)

# Weights to use for the optimization function
percentage_filled_weight_constant = 0.33  # Weight for percentage filled
preferred_day_hour_weight_constant = 20  # Weight for preferred day and hour
raining_weight_constant = 5  # Weight for raining
preferred_facility_weight_constant = 10  # Weight for preferred facility

# List of available facilities
available_facilities = [
    "Racquetball Court 1",
    "Racquetball Court 2",
    "Racquetball Court 3",
    "Racquetball Court 4",
    "Squash Court 1",
    "Galleria",
    "Main Gym Court 1 (North)",
    "Main Gym Court 2 (South)",
    "Outdoor Fitness 1 (Turf, Free Weights, Benches)",
    "Pavilion Court 1 (West)",
    "Pavilion Court 2 (East)",
    "Outdoor Fitness 2 (Behind Pottery)",
    "FC 1- North Room",
    "FC 1 - South Room",
    "FC 2 - 1st floor",
    "FC 2- Mezzanine",
    "FC 3 - MAC",
    "MAC Court",
    "Spa",
    "Small Pool",
    "Big Pool",
    "Pool Deck",
    "Climbing Center - MAC",
]

# List of available activities
available_activities = [
    "racquetball",
    "squash",
    "ellipticals (precor branded machines)",
    "stairmasters (stair machines)",
    "treadmills",
    "basketball",
    "benching",
    "bike machines",
    "weight lifting",
    "badminton",
    "arm machines",
    "core machines",
    "leg presses",
    "arm & leg machines",
    "stairmasters",
    "weight crunch machines",
    "hockey",
    "skating",
    "swimming",
    "climbing",
    # Some facilities ("Spa", "Pool Deck") have activities listed as "NA" which are excluded from the available activities
]

# List of available exercise categories
available_exercise_categories = [
    "cardio",
    "arms",
    "core",
    "legs",
    "weight training",
    # Some facilities ("MAC Court", "Pool Deck", "Spa", "Climbing Center - MAC") use "NA" as a category which are excluded from the available exercise categories
]

# Weeks start Monday; January 16, 2026 is in calendar week whose Monday is 2026-01-12.
starting_date = date(2026, 1, 16)
anchor_monday = starting_date - timedelta(days=starting_date.weekday())

# Convert the day of the week to a name
day_to_name = {
    "M": "Monday",
    "T": "Tuesday",
    "W": "Wednesday",
    "R": "Thursday",
    "F": "Friday",
    "S": "Saturday",
    "U": "Sunday",
}

# Order of the days of the week
day_order = ["M", "T", "W", "R", "F", "S", "U"]
