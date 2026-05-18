from datetime import date, datetime, timedelta
import pandas as pd
import argparse
import os

# TODO: This file is long and it might be worth splitting into multiple files (data preprocessing, user input, filtering, optimization, output formatting)

# Data preprocessing functions

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
    # TODO: These are hard coded values for testing purposes, remove these and uncomment the below lines
    current_week_forecast = pd.read_csv("../../predictions/Week 16/forecast_values.csv")
    next_week_forecast = pd.read_csv("../../predictions/Week 17/forecast_values.csv")
    # current_week_forecast = pd.read_csv(f"../../predictions/Week {current_week_number}/forecast_values.csv")
    # next_week_forecast = pd.read_csv(f"../../predictions/Week {next_week_number}/forecast_values.csv")
    # Split the exercise categories and activites into a list for the current week's forecast
    current_week_forecast = split_column_to_list(current_week_forecast, "categories", "category_list")
    current_week_forecast = split_column_to_list(current_week_forecast, "activities", "activity_list")
    # Split the exercise categories and activites into a list for the next week's forecast
    next_week_forecast = split_column_to_list(next_week_forecast, "categories", "category_list")
    next_week_forecast = split_column_to_list(next_week_forecast, "activities", "activity_list")
    return current_week_forecast, next_week_forecast





# User input functions

# Get the user's preferred activities and exercise categories   
def get_user_preferred_activities_and_exercise_categories(args):
    user_activities, user_exercise_categories = set(args.preferred_activities.split(",") if args.preferred_activities else []), set(args.preferred_exercise_categories.split(",") if args.preferred_exercise_categories else [])
    if user_activities == set([]) and user_exercise_categories == set([]):
        print("No preferred activities or exercise categories entered, please enter at least one activity or exercise category")
        exit()
    return user_activities, user_exercise_categories

# Get the user's preferred hours to go to the gym
def get_user_preferred_days_hours(args):
    preferred_days_hours = []
    parts = [p.strip() for p in args.preferred_days_hours.lower().strip().split(";") if p.strip()]
    for day, hours in zip(parts[0::2], parts[1::2]):
        day = day.upper()[0]
        hours = (int(hours.split(",")[0]), int(hours.split(",")[1]))
        preferred_days_hours.append((day, hours))
    return preferred_days_hours


# Get the set of user's unavailable days and hours (this will be gotten from google calendar integration from the frontend in the future)
def get_user_unavailable_days_hours(args):
    unavailable_days_hours = []
    parts = [p.strip() for p in args.unavailable_days_hours.lower().strip().split(";") if p.strip()]
    for day, hours in zip(parts[0::2], parts[1::2]):
        day = day.upper()[0]
        hours = (int(hours.split(",")[0]), int(hours.split(",")[1]))
        unavailable_days_hours.append((day, hours))
    return unavailable_days_hours

# Get the user's preferred facilities
def get_user_preferred_facilities(args):
    return {p.strip() for p in args.preferred_facilities.split(";") if p.strip()}

def get_user_preferred_facilities_hard_filter(args):
    return args.preferred_facilities_hard_filter == "yes" or args.preferred_facilities_hard_filter == "y"

def get_user_rain_filter(args):
    return args.rain_filter == "yes" or args.rain_filter == "y"

# Filtering functions

# Filter the forecast facility data to only include facilites that user would prefer
# by checking if the user's preferred activities and exercise categories are in the category and activity lists
# only remove if neither match
def filter_matching_preferences(df, preferred_activities, preferred_categories):
    is_matching_activity = df["activity_list"].apply(lambda lst: bool(preferred_activities & set(lst)))
    is_matching_category = df["category_list"].apply(lambda lst: bool(preferred_categories & set(lst)))
    result = df.loc[is_matching_activity | is_matching_category]
    if result.empty:
        print("No recommendations found, reason: there are no matching activities or exercise categories")
        return None
    return result

# Remove only rows that are both outdoor and raining (keep indoor; keep outdoor when dry)
def filter_outdoor_facilities(df):
    outdoor = df["is_outdoor_facility"] == True
    raining = df["is_raining"] == True
    result = df.loc[~(outdoor & raining)]
    if result.empty:
        print("No recommendations found, reason: there are no outdoor facilities available when raining")
        return None
    return result

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
    if output.empty:
        print("No recommendations found, reason: there are no preferred days and hours")
        return None
    return output

# Filter the forecast to remove rows where it is raining if the user has a hard filter for rain
def filter_rain(df, rain_filter):
    result = df.loc[~(df["is_raining"] == True)] if rain_filter else df
    if result.empty:
        print("No recommendations found, reason: rain is a hard filter and there is no available time when not raining")
        return None
    return result

# Filter the forecast to remove facilities that are not preferred by the user if the user has a hard filter for preferred facilities
def filter_preferred_facilities(df, preferred_facilities_hard_filter):
    result = df.loc[df["is_preferred_facility"] == True] if preferred_facilities_hard_filter else df
    if result.empty:
        print("No recommendations found, reason: preferred facilities is a hard filter and there are no preferred facilities found with matching exercise categories and activities or no preferred facilities listed")
        return None
    return result


# Filter the forecast to remove unavailable days and hours
def filter_unavailable_days_hours(df, unavailable_days_hours):
    for day, hours in unavailable_days_hours:
        df = df.loc[(df["day_of_week"] != day) | (df["hour"] < hours[0]) | (df["hour"] > hours[1])]
    if df.empty:
        print("No recommendations found, reason: there are no available days and hours")
        return None
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
            # Distinguish category-based rows from activity-based rows in the overall summary
            category_df["recommendation_type"] = "exercise_category"
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
            # Distinguish activity-based rows from category-based rows in the overall summary
            activity_df["recommendation_type"] = "activity"
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
    # TODO: These are hard coded values for testing purposes, remove these and uncomment the below lines
    current_week_forecast.to_csv("../../predictions/Week 16/forecast_values_filtered.csv", index=False)
    next_week_forecast.to_csv("../../predictions/Week 17/forecast_values_filtered.csv", index=False)
    # current_week_forecast.to_csv(f"../../predictions/Week {current_week_number}/forecast_values_filtered.csv", index=False)
    # next_week_forecast.to_csv(f"../../predictions/Week {next_week_number}/forecast_values_filtered.csv", index=False)

# Recommend times
def recommend_times(args, current_week_forecast, next_week_forecast, current_week_number, next_week_number):
    # Get the user's preferences from the command line
    user_activities, user_exercise_categories = get_user_preferred_activities_and_exercise_categories(args)
    preferred_days_hours = get_user_preferred_days_hours(args)
    unavailable_days_hours = get_user_unavailable_days_hours(args)
    preferred_facilities = get_user_preferred_facilities(args)
    rain_filter = get_user_rain_filter(args)
    preferred_facilities_hard_filter = get_user_preferred_facilities_hard_filter(args)
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
    # Filter the current and next week forecasts to remove facilities that are not preferred by the user if the user has a hard filter for preferred facilities
    current_week_forecast = filter_preferred_facilities(current_week_forecast, preferred_facilities_hard_filter)
    next_week_forecast = filter_preferred_facilities(next_week_forecast, preferred_facilities_hard_filter)

    if current_week_forecast is None and next_week_forecast is None:
        print("No recommendations found for either week!")
        return None, None

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

# Overall recommendation functions


# Collect overall recommendations for the week (maximizing score for every day of the week)
def collect_overall_recommendations(df):
    recommendations = []
    # Store all days and activity/exercise categories that have been filled
    filled_days = []
    filled_activities_categories = []
    filled_activities_categories_length = len(df["optimized_activity_or_exercise_category"].unique())
    # Sort the rows by highest score
    df = df.sort_values(by="total_score", ascending=False)
    # Fill all days of the week with the highest scoring recommendations for those days
    for day in day_order:
        # Collect the highest overall score row and its day and activity/exercise category
        for row in range(len(df)):
            highest_score_row = df.iloc[row]
            row_day = highest_score_row["day_of_week"][0]
            row_activity_category = highest_score_row["optimized_activity_or_exercise_category"]
            # If that day has not been occupied and the activity/exercise category has not been filled, add the recommendation to the set
            if row_day not in filled_days and row_activity_category not in filled_activities_categories:
                recommendations.append(highest_score_row)
                filled_days.append(row_day)
                filled_activities_categories.append(row_activity_category)
                break
        # If all activites or exercise categories have been filled, reset the filled activites and exercise categories
        if len(filled_activities_categories) == filled_activities_categories_length:
            filled_activities_categories = []
    return recommendations

# Format one line for the overall recommendations
def format_one_overall_recommendation_line(row):
    day = row["day_of_week"][0]
    label = row["optimized_activity_or_exercise_category"]
    output = ""
    output += f"On {day_to_name[day]} go to {row['facility_name']} at "
    output += f"{hour_to_ampm(int(row['hour']))} for {label} (Score: {row['total_score']})\n"
    return output

# Format the overall recommendations (split by exercise categories vs activities when recommendation_type is present)
def format_overall_recommendations(df):
    overall_recs = collect_overall_recommendations(df)
    # Sort the recommendations by day of the week
    overall_recs.sort(key=lambda x: day_order.index(x["day_of_week"]))
    body = "".join(
        format_one_overall_recommendation_line(recommendation)
        for recommendation in overall_recs
    )
    return (
        "Overall Recommendations:\n"
        "--------------------------------\n"
        + body
        + "--------------------------------\n"
    )
    

# Format the recommendations
# TODO: We may want to format the recommendations into a json object instead of a string so that it is easier to parse and use in the frontend.
# Perhaps its best to do both and return both the string and the json object.
# Also this does not work for the "or" cases where the facilities are different for the same day and hour. This second issue should be fixed first
def format_activity_category_recommendations(df):
    output = []
    # Group by activity or exercise category and iterate through each group
    grouped = df.groupby("optimized_activity_or_exercise_category")
    for category in sorted(grouped.groups.keys()):
        group = grouped.get_group(category)
        # Recommendations for this activity or exercise category
        output.append(f"Recommendations for {category}:\n")
        output.append(f"--------------------------------\n")
        for day in day_order:
            # Recommendations for this day
            day_rows = group[group["day_of_week"] == day]
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
                    f"On {day_to_name[day]} go to {facility_name} {time_part} (Score: {fac_rows['total_score'].iloc[0]})\n"
                )
        # Separate the recommendations for this activity or exercise category
        output.append(f"\n\n")
    # Overall recommendations of categories and activities
    output.append(format_overall_recommendations(df))
    return output

def format_recommendations_to_print(current_week_recommendations, next_week_recommendations):
    formatted_current_week_recommendations = format_activity_category_recommendations(current_week_recommendations)
    formatted_next_week_recommendations = format_activity_category_recommendations(next_week_recommendations)
    output = ""
    output += "="*50 + "\n"
    output += "CURRENT WEEK RECOMMENDATIONS:\n"
    output += "="*50 + "\n"
    output += "".join(formatted_current_week_recommendations) + "\n"
    output += "="*50 + "\n"
    output += "NEXT WEEK RECOMMENDATIONS:\n"
    output += "="*50 + "\n"
    output += "".join(formatted_next_week_recommendations) + "\n"
    output += "="*50 + "\n"
    return output

def invoke_argparse():
    parser = argparse.ArgumentParser(
        description="Recommend Recreation Center gym times based on user preferences.",
        epilog=(
            "Available facilities:\n" +
            "\n".join(f"- {facility}" for facility in available_facilities) +
            "\nAvailable activities:\n" +
            "\n".join(f"- {activity}" for activity in available_activities) +
            "\nAvailable exercise categories:\n" +
            "\n".join(f"- {category}" for category in available_exercise_categories)
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--preferred-activities", type=str, help="Enter the activities you are interested in (comma separated) (Either enter activities or exercise categories, or both, do not leave both blank). See available activities below.", required=False)
    parser.add_argument("--preferred-exercise-categories", type=str, help="Enter the exercise categories you are interested in (comma separated) (Either enter activities or exercise categories, or both, do not leave both blank). See available exercise categories below.", required=False)
    parser.add_argument("--preferred-days-hours", type=str, help="Enter the days and hours you prefer to go (comma separated) (day; hour range (min, max)), leave blank if you are not interested in any days or hours", required=False, default="None")
    parser.add_argument("--unavailable-days-hours", type=str, help="Enter the days and hours you are unavailable (comma separated) (day; hour range (min, max))", required=True, default="None")
    parser.add_argument("--preferred-facilities", type=str, help="Facilities you prefer: semicolon-separated. Leave blank if none. See available facilities below.", required=False, default="None")
    parser.add_argument("--rain-filter", type=str, help="Enter whether rain is a hard filter for you (enter yes if you strictly prefer to go to the gym when not raining) (yes/no)", required=False, default="no")
    parser.add_argument("--preferred-facilities-hard-filter", type=str, help="Enter whether preferred facilities is a hard filter for you (enter yes if you strictly prefer to go to the gym at your preferred facilities) (yes/no)", required=False, default="no")
    args = parser.parse_args()
    return args

def main():
    # Get the user's preferences from the command line
    args = invoke_argparse()

    # Get the current and next week numbers
    current_week_number, next_week_number = get_current_next_week_numbers()
    # Load the current and next week forecast data
    current_week_forecast, next_week_forecast = load_data(current_week_number, next_week_number)
    # Recommend the times
    current_week_recommendations, next_week_recommendations = recommend_times(args, current_week_forecast, next_week_forecast, current_week_number, next_week_number)
    if current_week_recommendations is None or next_week_recommendations is None:
        print("No recommendations found for current week or next week!")
        return
    # Save the recommendations to CSV files
    # TODO: These are hard coded values for testing purposes, remove these and uncomment the below lines
    current_week_recommendations.to_csv("../../predictions/Week 16/recommendations.csv", index=False)
    next_week_recommendations.to_csv("../../predictions/Week 17/recommendations.csv", index=False)
    # current_week_recommendations.to_csv(f"../../predictions/Week {current_week_number}/recommendations.csv", index=False)
    # next_week_recommendations.to_csv(f"../../predictions/Week {next_week_number}/recommendations.csv", index=False)
    print(f"Recommended times saved to CSV files")

    # Print the set of formatted recommendations
    formatted_recommendations_to_print = format_recommendations_to_print(current_week_recommendations, next_week_recommendations)
    print(formatted_recommendations_to_print)

    # Save the formatted recommendations to a text file
    with open("recommendations.txt", "w") as f:
        f.write(formatted_recommendations_to_print)

if __name__ == "__main__":
    main()