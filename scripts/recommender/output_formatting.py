import json
from itertools import zip_longest

from constants import day_order, day_to_name

# Output formatting functions


# Convert the hour to AM/PM format
def hour_to_ampm(h):
    if h == 0:
        return "12:00 AM"
    if 1 <= h <= 11:
        return f"{h}:00 AM"
    if h == 12:
        return "12:00 PM"
    return f"{h - 12}:00 PM"


# Overall recommendation functions


# Collect overall recommendations for the week (maximizing score for every day of the week)
def collect_overall_recommendations(df):
    recommendations = []
    # Store all days and activity/exercise categories that have been filled
    filled_days = []
    filled_activities_categories = []
    filled_activities_categories_length = len(
        df["optimized_activity_or_exercise_category"].unique()
    )
    # Sort the rows by highest score
    df = df.sort_values(by="total_score", ascending=False)
    # Fill all days of the week with the highest scoring recommendations for those days
    for day in day_order:
        # Collect the highest overall score row and its day and activity/exercise category
        for row in range(len(df)):
            highest_score_row = df.iloc[row]
            row_day = highest_score_row["day_of_week"][0]
            row_activity_category = highest_score_row[
                "optimized_activity_or_exercise_category"
            ]
            # If that day has not been occupied and the activity/exercise category has not been filled, add the recommendation to the set
            if (
                row_day not in filled_days
                and row_activity_category not in filled_activities_categories
            ):
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
    output += (
        f"{hour_to_ampm(int(row['hour']))} for {label} (Score: {row['total_score']})\n"
    )
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


# Build the json format for the current and next week recommendations
# See example of the outputted format at example_recommendations.json which was produced using example command #3
def build_week_recommendations_json(df):
    by_category = []
    # Group the recommendations by exercise category
    for category, cat_df in df.groupby(
        "optimized_activity_or_exercise_category", sort=False
    ):
        # Group the recommendations by day of the week
        # For each day of the week, get the recommendations
        schedule_entries = []
        for day, day_df in cat_df.groupby("day_of_week", sort=False):
            # Get the recommendations for the day
            options = [
                {
                    "facility_name": row["facility_name"],
                    "time_of_day": hour_to_ampm(int(row["hour"])),
                    "score": row["total_score"],
                }
                for _, row in day_df.sort_values(
                    "total_score", ascending=False
                ).iterrows()
            ]
            schedule_entries.append(
                (day_order.index(day), {"day": day_to_name[day], "options": options})
            )
        schedule_entries.sort(key=lambda entry: entry[0])
        schedule = [entry[1] for entry in schedule_entries]
        # Add the exercise category to the by_category list
        by_category.append(
            {
                "id": category,
                "label": category,
                "type": cat_df["recommendation_type"].iloc[0],
                "schedule": schedule,
            }
        )
    # Get the overall recommendations
    overall_recommendations = collect_overall_recommendations(df)
    # Sort the overall recommendations by day of the week
    overall_recommendations.sort(key=lambda x: day_order.index(x["day_of_week"]))
    # Add the overall recommendations to the overall list
    overall = [
        {
            "day": day_to_name[row["day_of_week"][0]],
            "activity_or_category": row["optimized_activity_or_exercise_category"],
            "type": row["recommendation_type"],
            "facility_name": row["facility_name"],
            "time_of_day": hour_to_ampm(int(row["hour"])),
        }
        for row in overall_recommendations
    ]
    return {"by_category": by_category, "overall": overall}


# Format the current and next weeks recommendation JSON
def build_recommendations_json(current_week_recommendations, next_week_recommendations):
    return {
        "current_week": build_week_recommendations_json(current_week_recommendations),
        "next_week": build_week_recommendations_json(next_week_recommendations),
    }


# Save the current and next week recommendations to a JSON file
def save_recommendations_json(payload, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


# Format the current and next weeks recommendations for text output
# Note: Scores are included in the text output for debugging, but will not be included in the JSON.
def format_activity_category_recommendations(df):
    output = ""
    # Since we have at most 2 recommendations for each day of the week, we can iterate through the first and next row pairs of recommendations
    prev_category_or_activity = None
    for current_row, next_row in zip_longest(
        df.itertuples(), df.iloc[1:].itertuples(), fillvalue=None
    ):
        # Current row values
        current_day_of_week = current_row.day_of_week
        current_activity_or_category = (
            current_row.optimized_activity_or_exercise_category
        )
        current_facility_name = current_row.facility_name
        current_hour = current_row.hour
        current_total_score = current_row.total_score
        # Account for case that there is only one recommendation
        if next_row is None:
            # Check if the current is included in a pair of existing recommendations
            if (
                len(df) == 1
                or current_day_of_week != df.iloc[-2]["day_of_week"]
                or current_activity_or_category
                != df.iloc[-2]["optimized_activity_or_exercise_category"]
            ):
                # If the current category or activity is different from the previous one, add a new line and header
                if prev_category_or_activity != current_activity_or_category:
                    output += "\n\n"
                    output += f"Recommendations for {current_activity_or_category}:\n"
                    output += f"--------------------------------\n"
                output += f"On {day_to_name[current_day_of_week]} go to {current_facility_name} at {hour_to_ampm(int(current_hour))} for {current_activity_or_category} (Score: {current_total_score})\n"
            break
        # If the current category or activity is different from the previous one, add a new line and header
        if prev_category_or_activity != current_activity_or_category:
            output += "\n\n"
            output += f"Recommendations for {current_activity_or_category}:\n"
            output += f"--------------------------------\n"
            prev_category_or_activity = current_activity_or_category
        # Next row values
        next_day_of_week = next_row.day_of_week
        next_facility_name = next_row.facility_name
        next_hour = next_row.hour
        next_total_score = next_row.total_score
        # If the next day of the week is the same as the current one, add "or" to the output, then add either add the second facility if its different than the first or don't
        if next_day_of_week == current_day_of_week:
            # If the current facility is different than the next facility, add "or" to the output and add the second facility, otherwise just add the second hour
            if current_facility_name != next_facility_name:
                output += f"On {day_to_name[current_day_of_week]} go to {current_facility_name} at {hour_to_ampm(int(current_hour))}"
                output += f" or go to {next_facility_name} at {hour_to_ampm(int(next_hour))} for {current_activity_or_category} (Scores; first: {current_total_score}, second: {next_total_score})\n"
            else:
                output += f"On {day_to_name[current_day_of_week]} go to {current_facility_name} at {hour_to_ampm(int(current_hour))} or {hour_to_ampm(int(next_hour))} for {current_activity_or_category} (Scores; first: {current_total_score}, second: {next_total_score})\n"
    # Add the overall recommendations to the output
    output += f"\n\n{format_overall_recommendations(df)}"
    return output


# Format the layout current and next week recommendations are contained in
def format_recommendations_to_print(
    current_week_recommendations, next_week_recommendations
):
    formatted_current_week_recommendations = format_activity_category_recommendations(
        current_week_recommendations
    )
    formatted_next_week_recommendations = format_activity_category_recommendations(
        next_week_recommendations
    )
    output = ""
    output += "=" * 50 + "\n"
    output += "CURRENT WEEK RECOMMENDATIONS:\n"
    output += "=" * 50 + "\n"
    output += formatted_current_week_recommendations + "\n"
    output += "=" * 50 + "\n"
    output += "NEXT WEEK RECOMMENDATIONS:\n"
    output += "=" * 50 + "\n"
    output += formatted_next_week_recommendations + "\n"
    output += "=" * 50 + "\n"
    return output
