from datetime import date, datetime, timedelta
import pandas as pd




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
    # input_exercise_categories = input("Enter the exercise categories you are interested in (comma separated): ").lower().strip().split(",")
    # input_activities = input("Enter the activities you are interested in (comma separated): ").lower().strip().split(",")
    # return set(input_activities), set(input_exercise_categories)
    return set(["climbing", "badminton", "weight lifting", "bike machines"]), set(["arms", "legs", "core", "cardio"])


# Get the user's preferred hours to go to the gym
def get_user_preferred_days_hours():
    # input_days_hours = input("Enter the days and hours you prefer to go (comma separated) (day; hour range (min, max)): ").lower().strip().split("; ")
    # output = []
    # for day, hours in input_days_hours:
    #     day = day.upper()[0]
    #     hours = (int(hours.split(",")[0]), int(hours.split(",")[1]))
    #     output.append((day, hours))
    # return output
    return [("M", (10, 12)), ("T", (10, 12)), ("W", (13, 15)), ("R", (10, 12)), ("F", (10, 12)), ("S", (9, 12)), ("U", (9, 12))]

# Get the set of user's unavailable days and hours
def get_user_unavailable_days_hours():
    # input_days_hours = input("Enter the days and hours you are unavailable (comma separated) (day; hour range (min, max)): ").lower().strip().split("; ")
    # output = []
    # for day, hours in input_days_hours:
    #     day = day.upper()[0]
    #     hours = (int(hours.split(",")[0]), int(hours.split(",")[1]))
    #     output.append((day, hours))
    # return output
    return [("T", (10, 12)), ("W", (10, 12)), ("S", (9, 12))]

# TODO: Get the user's preferred facilities

# Validation functions
# TODO: Implement user input validation functions
# This may not be necessary if input is validated/restricted in the frontend



# Filtering functions

# Filter the forecast facility data to only include facilites that user would prefer
# by checking if the user's preferred activities and exercise categories are in the category and activity lists
# only remove if neither match
def filter_matching_preferences(df, preferred_activities, preferred_categories):
    is_matching_activity = df["activity_list"].apply(lambda lst: bool(preferred_activities & set(lst)))
    is_matching_category = df["category_list"].apply(lambda lst: bool(preferred_categories & set(lst)))
    return df.loc[is_matching_activity | is_matching_category]

# Remove only rows that are both outdoor and raining (keep indoor; keep outdoor when dry)
def filter_outdoor_facilities(df):
    outdoor = df["is_outdoor_facility"] == True
    raining = df["is_raining"] == True
    return df.loc[~(outdoor & raining)]

# Add column is_preferred_day_hour to indicate if the row falls within user's preferred days and hours
def augment_with_preferred_days_hours(df, preferred_days_hours):
    output = df.copy()
    # For each row, check if day_of_week and hour match any of the preferred days and hours
    def is_preferred(row):
        for day, (low, high) in preferred_days_hours:
            if row["day_of_week"] == day and low <= row["hour"] <= high:
                return True
        return False
    output["is_preferred_day_hour"] = output.apply(is_preferred, axis=1)
    return output


# Filter the forecast to remove unavailable days and hours
def filter_unavailable_days_hours(df, unavailable_days_hours):
    for day, hours in unavailable_days_hours:
        df = df.loc[(df["day_of_week"] != day) | (df["hour"] < hours[0]) | (df["hour"] > hours[1])]
    return df


# TODO: Add a boolean indicating whether the facility is preferred by the user


# Optimization functions

# Return a set of optimal times (optimal for minimal attendance and preferred times) for each day of the week for both forecasts
def optimize_days_and_hours(current_week_forecast, next_week_forecast, user_exercise_categories, user_activities):

    # Get the optimal times in a day by optimizing for minimal attendance and preferred times
    def optimize_day(df):
        # Convert categorical variables to numeric and add higher penalty to these values
        df = df.copy()
        preferred_weight = 10
        raining_weight = 5
        df["is_preferred_day_hour"] = (df["is_preferred_day_hour"].astype(int)) * preferred_weight
        df["is_raining"] = abs(1 - df["is_raining"].astype(int)) * raining_weight # Taking inverse of is_raining since we want to increase the score when its not raining
        # Calculate a categorical score to maximize
        df["categorical_score"] = df["is_preferred_day_hour"] + df["is_raining"]
        # Sort recommendations by categorical score and percentage_filled
        df = df.sort_values(by=["categorical_score", "percentage_filled"], ascending=[False, True])
        # Drop duplicate timestamps to avoid recommending the same timestamp twice
        df = df.drop_duplicates(subset=["timestamp"], keep="first")
        # Return the two highest categorical score rows of optimal day/hour combinations
        return df.head(2)
        
    # Get the optimal times for each day of the week
    def optimize_week(df):
        # Split df into list of dfs for each day of the week
        day_dfs = [df[df["day_of_week"] == day] for day in sorted(df["day_of_week"].unique())]
        # For each day, get the optimal day/hour combinations
        recommended_week_dfs = []
        for day_df in day_dfs:
            recommended_week_dfs.append(optimize_day(day_df))
        # Sort the recommended day dfs by day of the week and hour
        day_order = ["M", "T", "W", "R", "F", "S", "U"]
        day_order_index = {day: i for i, day in enumerate(day_order)}
        
        recommended_week_dfs.sort(
            key=lambda df: (day_order_index.get(df["day_of_week"].iloc[0], 100), df["hour"].iloc[0])
        )
 
        # Combine the recommended week dfs into a single dataframe and return
        return pd.concat(recommended_week_dfs, ignore_index=True)

    # Create optimized weekly day/hour combinations by exercise category
    def optimize_by_exercise_category(df, user_exercise_categories):
        recommended_category_dfs = []
        # For each exercise category, get the optimal weekly day/hour combinations
        for category in user_exercise_categories:
            category_df = df[df["category_list"].apply(lambda lst: category in lst)].copy()
            if category_df.empty:
                continue
            category_df["optimized_activity_or_exercise_category"] = category
            recommended_category_dfs.append(optimize_week(category_df))
        # Combine the recommended category dfs into a single dataframe and return
        return pd.concat(recommended_category_dfs, ignore_index=True) if recommended_category_dfs else pd.DataFrame()

    # Create optimized weekly day/hour combinations by activity
    def optimize_by_activity(df, user_activities):
        recommended_activity_dfs = []
        # For each activity, get the optimal weekly day/hour combinations
        for activity in user_activities:
            activity_df = df[df["activity_list"].apply(lambda lst: activity in lst)].copy()
            if activity_df.empty:
                continue
            activity_df["optimized_activity_or_exercise_category"] = activity
            recommended_activity_dfs.append(optimize_week(activity_df))
        # Combine the recommended activity dfs into a single dataframe and return
        return pd.concat(recommended_activity_dfs, ignore_index=True) if recommended_activity_dfs else pd.DataFrame()

    # Current week: optimize by exercise category and activity
    current_week_exercise_category = optimize_by_exercise_category(current_week_forecast, user_exercise_categories)
    current_week_activity = optimize_by_activity(current_week_forecast, user_activities)
    # Combine the exercise category and activity dataframes to get the recommended current week forecast
    recommended_current_week_forecast = pd.concat([current_week_exercise_category, current_week_activity], ignore_index=True)

    # Next week: optimize by exercise category and activity
    next_week_exercise_category = optimize_by_exercise_category(next_week_forecast, user_exercise_categories)
    next_week_activity = optimize_by_activity(next_week_forecast, user_activities)
    # Combine the exercise category and activity dataframes to get the recommended next week forecast
    recommended_next_week_forecast = pd.concat([next_week_exercise_category, next_week_activity], ignore_index=True)
    return recommended_current_week_forecast, recommended_next_week_forecast


# Recommender functions

# Save the current and next week forecasts to a CSV file
def save_data(current_week_forecast, next_week_forecast, current_week_number, next_week_number):
    current_week_forecast.to_csv(f"../../predictions/Week {current_week_number}/forecast_values_filtered.csv", index=False)
    next_week_forecast.to_csv(f"../../predictions/Week {next_week_number}/forecast_values_filtered.csv", index=False)

# Recommend times
def recommend_times(current_week_forecast, next_week_forecast, current_week_number, next_week_number):
    # User input

    # Get the user's preferred activities and exercise categories
    user_activities, user_exercise_categories = get_user_preferred_activities_and_exercise_categories()
    # Get the user's preferred hours to go to the gym
    preferred_days_hours = get_user_preferred_days_hours()
    # Get the user's unavailable days and hours
    unavailable_days_hours = get_user_unavailable_days_hours()

    # Filtering

    # Filter the current and next week forecasts to only include activities and exercise categories that the user is interested in
    current_week_forecast = filter_matching_preferences(current_week_forecast, user_activities, user_exercise_categories)
    next_week_forecast = filter_matching_preferences(next_week_forecast, user_activities, user_exercise_categories)
    # Filter the current and next week forecasts to eliminate outdoor facilities when it is raining
    current_week_forecast = filter_outdoor_facilities(current_week_forecast)
    next_week_forecast = filter_outdoor_facilities(next_week_forecast)
    # Augment the current and next week forecasts with the user's preferred hours
    current_week_forecast = augment_with_preferred_days_hours(current_week_forecast, preferred_days_hours)
    next_week_forecast = augment_with_preferred_days_hours(next_week_forecast, preferred_days_hours)
    # Filter the current and next week forecasts to remove unavailable days and hours
    current_week_forecast = filter_unavailable_days_hours(current_week_forecast, unavailable_days_hours)
    next_week_forecast = filter_unavailable_days_hours(next_week_forecast, unavailable_days_hours)


    # print(f"Current week forecast: {current_week_forecast}")
    # print(f"Next week forecast: {next_week_forecast}")
    save_data(current_week_forecast, next_week_forecast, current_week_number, next_week_number)

    # Recommendations

    current_week_recommendations, next_week_recommendations = optimize_days_and_hours(current_week_forecast, next_week_forecast, user_exercise_categories, user_activities)
    # Drop the columns not needed for cleaner output
    current_week_recommendations = current_week_recommendations.drop(columns=["predicted_count", "is_outdoor_facility", "categories", "activities", "activity_list", "category_list"])
    next_week_recommendations = next_week_recommendations.drop(columns=["predicted_count", "is_outdoor_facility", "categories", "activities", "activity_list", "category_list"])
    # Return the current and next week recommendations
    return current_week_recommendations, next_week_recommendations

# TODO: Output formatting functions


def main():
    current_week_number, next_week_number = get_current_next_week_numbers()
    current_week_forecast, next_week_forecast = load_data(current_week_number, next_week_number)
    # print(f"Current week number: {current_week_number}")
    # print(f"Next week number: {next_week_number}")
    # print(f"Current week forecast: {current_week_forecast}")
    # print(f"Next week forecast: {next_week_forecast}")
    current_week_recommendations, next_week_recommendations = recommend_times(current_week_forecast, next_week_forecast, current_week_number, next_week_number)
    # print(f"Current week recommendations: {current_week_recommendations}")
    # print(f"Next week recommendations: {next_week_recommendations}")
    current_week_recommendations.to_csv(f"../../predictions/Week {current_week_number}/recommendations.csv", index=False)
    next_week_recommendations.to_csv(f"../../predictions/Week {next_week_number}/recommendations.csv", index=False)
    print(f"Recommended times saved to CSV files")

    # print the recommendations by facility name, day of the week, and hour
    print(f"Current week recommendations by facility name, day of the week, and hour:")
    print(current_week_recommendations.groupby(["facility_name", "day_of_week", "hour"]).size().reset_index(name="count"), end = "\n\n")
    print(f"Next week recommendations by facility name, day of the week, and hour:")
    print(next_week_recommendations.groupby(["facility_name", "day_of_week", "hour"]).size().reset_index(name="count"))

if __name__ == "__main__":
    main()