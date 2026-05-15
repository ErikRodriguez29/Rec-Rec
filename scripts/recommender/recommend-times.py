from datetime import date, datetime, timedelta
import pandas as pd
import os



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
# TODO: Modify the input functions so that they parse CLI arguments instead of hardcoding/getting values from input

# Get the user's preferred activities and exercise categories   
def get_user_preferred_activities_and_exercise_categories():
    # input_exercise_categories = input("Enter the exercise categories you are interested in (comma separated): ").lower().strip().split(",")
    # input_activities = input("Enter the activities you are interested in (comma separated): ").lower().strip().split(",")
    # return set(input_activities), set(input_exercise_categories)
    # return set(["climbing", "badminton", "weight lifting", "bike machines"]), set(["arms", "legs", "core", "cardio"])
    # return set(["swimming", "climbing"]), set([])
    # return set(["racquetball"]), set([])
    return set(["weight lifting"]), set(["cardio"])


# Get the user's preferred hours to go to the gym
def get_user_preferred_days_hours():
    # input_days_hours = input("Enter the days and hours you prefer to go (comma separated) (day; hour range (min, max)): ").lower().strip().split("; ")
    # output = []
    # for day, hours in input_days_hours:
    #     day = day.upper()[0]
    #     hours = (int(hours.split(",")[0]), int(hours.split(",")[1]))
    #     output.append((day, hours))
    # return output
    return [("M", (14, 17)), ("T", (14, 17)), ("W", (14, 17)), ("R", (14, 17)), ("F", (14, 17)), ("S", (14, 17)), ("U", (14, 17))]


# TODO: Add google calendar integration to get the user's unavailable days and hours
# Get the set of user's unavailable days and hours
def get_user_unavailable_days_hours():
    # input_days_hours = input("Enter the days and hours you are unavailable (comma separated) (day; hour range (min, max)): ").lower().strip().split("; ")
    # output = []
    # for day, hours in input_days_hours:
    #     day = day.upper()[0]
    #     hours = (int(hours.split(",")[0]), int(hours.split(",")[1]))
    #     output.append((day, hours))
    # return output
    return [("T", (10, 12)), ("T", (10, 12)), ("S", (9, 12))]

# Get the user's preferred facilities
def get_user_preferred_facilities():
    # input_facilities = input("Enter the facilities you are interested in (comma separated): ").lower().strip().split(",")
    # return set(input_facilities)
    # return set([
    #     "Main Gym Court 1 (North)", 
    #     "Main Gym Court 2 (South)",
    #     "Outdoor Fitness 1 (Turf, Free Weights, Benches)",
    #     "Outdoor Fitness 2 (Behind Pottery)",
    #     "Pavilion Court 1 (West)",
    #     "Pavilion Court 2 (East)",
    #     "FC 1- North Room",
    #     "FC 1 - South Room",
    #     "FC 2 - 1st floor",
    #     "FC 2- Mezzanine",
    #     "FC 3 - MAC",
    #     "Climbing Center - MAC",
    # ])
    return set([
        # "FC 1- North Room",
        # "FC 1 - South Room",
        "FC 2 - 1st floor",
        "FC 2- Mezzanine",
        "FC 3 - MAC"
    ])

# Get whether rain is a hard filter (hard no) for the user
def get_user_rain_filter():
    # input_rain_filter = input("Enter whether rain is a hard filter for you (yes/no): ").lower().strip()
    # return input_rain_filter == "yes" or input_rain_filter == "y"
    return True

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

# Filter the forecast to remove rows where it is raining if the user has a hard filter for rain
def filter_rain(df, rain_filter):
    return df.loc[~(df["is_raining"] == True)] if rain_filter else df


# Filter the forecast to remove unavailable days and hours
def filter_unavailable_days_hours(df, unavailable_days_hours):
    for day, hours in unavailable_days_hours:
        df = df.loc[(df["day_of_week"] != day) | (df["hour"] < hours[0]) | (df["hour"] > hours[1])]
    return df


# Add a boolean indicating whether the facility is preferred by the user
def augment_with_preferred_facilities(df, preferred_facilities):
    output = df.copy()
    output["is_preferred_facility"] = output["facility_name"].isin(preferred_facilities)
    return output

# Optimization functions

# Return a set of optimal times (optimal for minimal attendance and preferred times) for each day of the week for both forecasts
def optimize_days_and_hours(current_week_forecast, next_week_forecast, user_exercise_categories, user_activities):

    # Get the optimal times in a day by optimizing for minimal attendance and preferred times
    def optimize_day(df):
        # Convert categorical variables to numeric and add higher penalty to these values
        df = df.copy()
        percentage_filled_weight = 0.33
        preferred_day_hour_weight = 20
        raining_weight = 5
        preferred_facility_weight = 10
        df["percentage_filled_score"] = ((100 - df["percentage_filled"]) * percentage_filled_weight).round(2) # Taking inverse of percentage_filled since we want to increase the score with lower attendance
   
        df["is_preferred_day_hour_score"] = (df["is_preferred_day_hour"].astype(int)) * preferred_day_hour_weight
        df["is_raining_score"] = abs(1 - df["is_raining"].astype(int)) * raining_weight # Taking inverse of is_raining since we want to increase the score when its not raining
        df["is_preferred_facility_score"] = (df["is_preferred_facility"].astype(int)) * preferred_facility_weight
        # Calculate a total score to maximize
        df["total_score"] = (df["percentage_filled_score"] + df["is_preferred_day_hour_score"] + df["is_raining_score"] + df["is_preferred_facility_score"]).round(2)
        # Sort recommendations by total score
        df = df.sort_values(by=["total_score"], ascending=False)
        # Return the two highest total score rows
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
    # Get the user's preferred facilities
    preferred_facilities = get_user_preferred_facilities()
    # Get whether rain is a hard filter for the user
    rain_filter = get_user_rain_filter()
    # Filtering

    # Filter the current and next week forecasts to only include activities and exercise categories that the user is interested in
    current_week_forecast = filter_matching_preferences(current_week_forecast, user_activities, user_exercise_categories)
    next_week_forecast = filter_matching_preferences(next_week_forecast, user_activities, user_exercise_categories)
    # Filter the current and next week forecasts to eliminate outdoor facilities when it is raining
    current_week_forecast = filter_outdoor_facilities(current_week_forecast)
    next_week_forecast = filter_outdoor_facilities(next_week_forecast)
    # Filter the current and next week forecasts to remove rows where it is raining if the user has a hard filter for rain
    current_week_forecast = filter_rain(current_week_forecast, rain_filter)
    next_week_forecast = filter_rain(next_week_forecast, rain_filter)
    # Augment the current and next week forecasts with the user's preferred hours
    current_week_forecast = augment_with_preferred_days_hours(current_week_forecast, preferred_days_hours)
    next_week_forecast = augment_with_preferred_days_hours(next_week_forecast, preferred_days_hours)
    # Filter the current and next week forecasts to remove unavailable days and hours
    current_week_forecast = filter_unavailable_days_hours(current_week_forecast, unavailable_days_hours)
    next_week_forecast = filter_unavailable_days_hours(next_week_forecast, unavailable_days_hours)
    # Augment the current and next week forecasts with the user's preferred facilities
    current_week_forecast = augment_with_preferred_facilities(current_week_forecast, preferred_facilities)
    next_week_forecast = augment_with_preferred_facilities(next_week_forecast, preferred_facilities)


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

# Output formatting functions



# Convert the hour to AM/PM format
def hour_to_ampm(h):
    if h == 0: return "12:00 AM"
    if 1 <= h <= 11: return f"{h}:00 AM"
    if h == 12: return "12:00 PM"
    return f"{h - 12}:00 PM"

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


# TODO: This function for getting overall recommendations could probably use two things. First is a better way of moving around the recommended days to maximize score other than 
# using a list for populated activities or exercise categories (such that suboptimal scores arent introduced to the recommendations just because of the order
# of the activites that are populated in the list (i.e if one day has a high score for an activity but the next day has a high score for a different activity,
# the first day should be preferred, however all activites should still be included in the recommendations).
#
# Second is that the overall recommendations should be split into two categories, one for exercise categories and one for activities (i.e one with the title 
# "Overall Recommendations (Exercise Categories)" and one with the title "Overall Recommendations (Activities)") and the recommendations should be split into two
# sections, one for exercise categories and one for activities. This requires changing/refactoring the earlier recommendation functions, so maybe do this later lol.

# Collect the overall recommendations which maximize score for each day while no category or activity is left out
def get_overall_recommendations(df):
    output = ""
    output += "Overall Recommendations:\n"
    output += "--------------------------------\n"
    scores_list_by_day = set()
    # Collect the day, activity or exercise category, and score for each recommendation
    for _, row in df.iterrows():
        day, activity_or_category, score, facility_name = row["day_of_week"], row["optimized_activity_or_exercise_category"], row["total_score"], row["facility_name"]
        scores_list_by_day.add((day[0], activity_or_category, score, facility_name))

    # Sort the scores list by day and score
    df = df.copy()
    sorted_scores_list_by_day = sorted(
        scores_list_by_day,
        key=lambda x: (day_order.index(x[0]), -x[2]) # Ascending order day, descending order score
    )

    total_num_activities_or_exercise_categories = len(set([x[1] for x in sorted_scores_list_by_day])) # Total number of activities or exercise categories
    populated_days = []
    populated_activities_or_exercise_categories = []

    # Append activity recommendations which maximize score for each day while no category or activity is left out. If all categories or activities are already populated,
    # clear the populated categories or activities and append new recommendations.
    for day, activity_or_category, score, facility_name in sorted_scores_list_by_day:
        # Check if day hasn't already been populated, skip otherwise
        if day not in populated_days:
            # Check if activity or exercise category hasn't already been populated
            if activity_or_category not in populated_activities_or_exercise_categories:
                populated_days.append(day)
                populated_activities_or_exercise_categories.append(activity_or_category)
                output += f"On {day_to_name[day]} go to {facility_name} at {hour_to_ampm(int(row['hour']))} for {activity_or_category} (Score: {score})\n"
            # If all categories or activities are already populated, clear the populated categories or activities and append new recommendations
            elif len(populated_activities_or_exercise_categories) == total_num_activities_or_exercise_categories:
                populated_activities_or_exercise_categories.clear()
                output += f"On {day_to_name[day]} go to {facility_name} at {hour_to_ampm(int(row['hour']))} for {activity_or_category} (Score: {score})\n"
            # If the activity or exercise category has already been populated, skip
            else: continue
        # print(populated_days)
        # print(populated_activities_or_exercise_categories)

    output += "--------------------------------\n"
    return output

# Format the recommendations
def format_recommendations(df):
    output = []
    # Group by activity or exercise category and iterate through each group
    grouped = df.groupby("optimized_activity_or_exercise_category")
    for category in sorted(grouped.groups.keys()):
        group = grouped.get_group(category)
        # Recommendations for this activity or exercise category
        output.append(f"Recommendations for {category}:")
        output.append(f"--------------------------------")
        for day_code in day_order:
            # Recommendations for this day
            day_rows = group[group["day_of_week"] == day_code]
            if day_rows.empty:
                continue
            # Recommendations for this facility
            for facility_name, fac_rows in day_rows.groupby("facility_name", sort=True):
                fac_rows = fac_rows.sort_values(by="hour")
                # Get the times for this facility and format them
                times = [hour_to_ampm(int(hour)) for hour in fac_rows["hour"]]
                time_part = " or ".join(f"at {time}" for time in times)
                # Add the recommendation for this facility to the output string
                output.append(
                    # Note: Score here returns the first recommendation score (before the or) which is the higher of the two scores of the recommendations for this facility
                    f"On {day_to_name[day_code]} go to {facility_name} {time_part} (Score: {fac_rows['total_score'].iloc[0]})"
                )
        # Separate the recommendations for this activity or exercise category
        output.append(f"\n\n")
    output.append(get_overall_recommendations(df))
    return "\n".join(output)

def format_recommendations_to_print(current_week_recommendations, next_week_recommendations):
    formatted_current_week_recommendations = format_recommendations(current_week_recommendations)
    formatted_next_week_recommendations = format_recommendations(next_week_recommendations)
    output = ""
    output += "="*50 + "\n"
    output += "CURRENT WEEK RECOMMENDATIONS:\n"
    output += "="*50 + "\n"
    output += formatted_current_week_recommendations + "\n"
    output += "="*50 + "\n"
    output += "NEXT WEEK RECOMMENDATIONS:\n"
    output += "="*50 + "\n"
    output += formatted_next_week_recommendations + "\n"
    output += "="*50 + "\n"
    return output

def main():
    current_week_number, next_week_number = get_current_next_week_numbers()
    current_week_forecast, next_week_forecast = load_data(current_week_number, next_week_number)
    current_week_recommendations, next_week_recommendations = recommend_times(current_week_forecast, next_week_forecast, current_week_number, next_week_number)
    current_week_recommendations.to_csv(f"../../predictions/Week {current_week_number}/recommendations.csv", index=False)
    next_week_recommendations.to_csv(f"../../predictions/Week {next_week_number}/recommendations.csv", index=False)
    print(f"Recommended times saved to CSV files")

    # Print the set of formatted recommendations
    formatted_recommendations_to_print = format_recommendations_to_print(current_week_recommendations, next_week_recommendations)
    print(formatted_recommendations_to_print)

    # Save the formatted recommendations to a text file
    with open("recommendations.txt", "w") as f:
        f.write(formatted_recommendations_to_print)

if __name__ == "__main__":
    main()