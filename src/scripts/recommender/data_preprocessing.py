import os
from datetime import datetime, timedelta

import pandas as pd
from constants import (
    current_week_load_path,
    next_week_load_path,
    predictions_week_path,
    use_hard_coded_load_paths,
    week1_monday,
)

# Data preprocessing functions


# Get the current and next week numbers
def get_current_next_week_numbers():
    forced = os.environ.get("FORCE_CURRENT_WEEK", "").strip()
    if forced:
        current_week = int(forced)
        return current_week, current_week + 1
    today = datetime.now().date()
    monday = today - timedelta(days=today.weekday())
    current_week = (monday - week1_monday).days // 7 + 1
    return current_week, current_week + 1


# Split a specified column into a list of values (separated by "; ")
def split_column_to_list(df, column, new_column):
    def parse_items(s):
        if pd.isna(s):
            return []
        return [part.strip() for part in str(s).split("; ") if part.strip()]

    output = df.copy()
    output[new_column] = output[column].map(parse_items)
    return output


# Load the current and next week forecast data
def load_data(current_week_number, next_week_number):
    if use_hard_coded_load_paths:
        current_week_forecast = pd.read_csv(current_week_load_path)
        next_week_forecast = pd.read_csv(next_week_load_path)
    else:
        current_week_forecast = pd.read_csv(
            predictions_week_path(current_week_number, "forecast_values.csv")
        )
        next_week_forecast = pd.read_csv(
            predictions_week_path(next_week_number, "forecast_values.csv")
        )
    # Split the exercise categories and activites into a list for the current week's forecast
    current_week_forecast = split_column_to_list(
        current_week_forecast, "categories", "category_list"
    )
    current_week_forecast = split_column_to_list(
        current_week_forecast, "activities", "activity_list"
    )
    # Split the exercise categories and activites into a list for the next week's forecast
    next_week_forecast = split_column_to_list(
        next_week_forecast, "categories", "category_list"
    )
    next_week_forecast = split_column_to_list(
        next_week_forecast, "activities", "activity_list"
    )
    return current_week_forecast, next_week_forecast
