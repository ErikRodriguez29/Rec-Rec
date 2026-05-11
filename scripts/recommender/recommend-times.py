from datetime import date, datetime, timedelta
import pandas as pd
# import os
# from paretoset import paretoset as ps




# Data preprocessing functions

# Weeks start Monday; January 16, 2026 is in calendar week whose Monday is 2026-01-12.
starting_date = date(2026, 1, 16)
anchor_monday = starting_date - timedelta(days=starting_date.weekday())

# Get the current and next week numbers
def get_current_next_week_numbers():
    today = datetime.now().date()
    monday = today - timedelta(days=today.weekday())
    week_no = ((monday - anchor_monday).days // 7) - 1
    return week_no, week_no + 1

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
    current_week_forecast = pd.read_csv(f"../../predictions/Week {current_week_number}/forecast_values.csv")
    next_week_forecast = pd.read_csv(f"../../predictions/Week {next_week_number}/forecast_values.csv")
    # Split the exercise categories and activites into a list for the current week's forecast
    current_week_forecast = split_column_to_list(current_week_forecast, "categories", "category_list")
    current_week_forecast = split_column_to_list(current_week_forecast, "activities", "activity_list")
    # Split the exercise categories and activites into a list for the next week's forecast
    next_week_forecast = split_column_to_list(next_week_forecast, "categories", "category_list")
    next_week_forecast = split_column_to_list(next_week_forecast, "activities", "activity_list")
    return current_week_forecast, next_week_forecast





# User input functions

# Get the user's preferred activities and exercise categories   
def get_user_preferred_activities_and_exercise_categories():
    input_exercise_categories = input("Enter the exercise categories you are interested in (comma separated): ").lower().strip().split(",")
    input_activities = input("Enter the activities you are interested in (comma separated): ").lower().strip().split(",")
    return set(input_activities), set(input_exercise_categories)

# Filter the forecast facility data to only include facilites that user would prefer
# by checking if the user's preferred activities and exercise categories are in the category and activity lists
# only remove if neither match
def filter_matching_preferences(df, preferred_activities, preferred_categories):
    filtered_preferences = df["activity_list"].apply(
        lambda lst: bool(preferred_activities & set(lst))) | df["category_list"].apply(lambda lst: bool(preferred_categories & set(lst)))
    return df.loc[filtered_preferences]





# Recommender functions

# Recommend times
def recommend_times(current_week_forecast, next_week_forecast):
    # Get the user's preferred activities and exercise categories
    user_activities, user_exercise_categories = get_user_preferred_activities_and_exercise_categories()
    # Filter the current and next week forecasts to only include activities and exercise categories that the user is interested in
    current_week_forecast = filter_matching_preferences(current_week_forecast, user_activities, user_exercise_categories)
    next_week_forecast = filter_matching_preferences(next_week_forecast, user_activities, user_exercise_categories)
    # Return the current and next week forecasts
    return current_week_forecast, next_week_forecast

# Save the current and next week forecasts to a CSV file
def save_data(current_week_forecast, next_week_forecast, current_week_number, next_week_number):
    current_week_forecast.to_csv(f"../../predictions/Week {current_week_number}/forecast_values_filtered.csv", index=False)
    next_week_forecast.to_csv(f"../../predictions/Week {next_week_number}/forecast_values_filtered.csv", index=False)


def main():
    current_week_number, next_week_number = get_current_next_week_numbers()
    current_week_forecast, next_week_forecast = load_data(current_week_number, next_week_number)
    # print(f"Current week number: {current_week_number}")
    # print(f"Next week number: {next_week_number}")
    # print(f"Current week forecast: {current_week_forecast}")
    # print(f"Next week forecast: {next_week_forecast}")
    current_week_forecast, next_week_forecast = recommend_times(current_week_forecast, next_week_forecast)
    print(f"Current week forecast: {current_week_forecast}")
    print(f"Next week forecast: {next_week_forecast}")
    save_data(current_week_forecast, next_week_forecast, current_week_number, next_week_number)

if __name__ == "__main__":
    main()