import pandas as pd
from constants import (
    day_order,
    percentage_filled_weight_constant,
    preferred_day_hour_weight_constant,
    preferred_facility_weight_constant,
    raining_weight_constant,
)

# Optimization functions


# Return a set of optimal times (optimal for minimal attendance and preferred times) for each day of the week for both forecasts
def optimize_days_and_hours(
    current_week_forecast, next_week_forecast, user_exercise_categories, user_activities
):

    # Get the optimal times in a day by optimizing for minimal attendance and preferred times
    def optimize_day(df):
        # Convert categorical variables to numeric and add higher penalty to these values
        df = df.copy()
        percentage_filled_weight = percentage_filled_weight_constant
        preferred_day_hour_weight = preferred_day_hour_weight_constant
        raining_weight = raining_weight_constant
        preferred_facility_weight = preferred_facility_weight_constant
        df["percentage_filled_score"] = (
            (100 - df["percentage_filled"]) * percentage_filled_weight
        ).round(
            2
        )  # Taking inverse of percentage_filled since we want to increase the score with lower attendance

        df["is_preferred_day_hour_score"] = (
            df["is_preferred_day_hour"].astype(int)
        ) * preferred_day_hour_weight
        df["is_raining_score"] = (
            abs(1 - df["is_raining"].astype(int)) * raining_weight
        )  # Taking inverse of is_raining since we want to increase the score when its not raining
        df["is_preferred_facility_score"] = (
            df["is_preferred_facility"].astype(int)
        ) * preferred_facility_weight
        # Calculate a total score to maximize
        df["total_score"] = (
            df["percentage_filled_score"]
            + df["is_preferred_day_hour_score"]
            + df["is_raining_score"]
            + df["is_preferred_facility_score"]
        ).round(2)
        # Sort recommendations by total score
        df = df.sort_values(by=["total_score"], ascending=False)
        # Return the two highest total score rows
        return df.head(2)

    # Get the optimal times for each day of the week
    def optimize_week(df):
        # Split df into list of dfs for each day of the week
        day_dfs = [
            df[df["day_of_week"] == day] for day in sorted(df["day_of_week"].unique())
        ]
        # For each day, get the optimal day/hour combinations
        recommended_week_dfs = []
        for day_df in day_dfs:
            recommended_week_dfs.append(optimize_day(day_df))
        # Sort the recommended day dfs by day of the week and hour
        day_order_index = {day: i for i, day in enumerate(day_order)}

        recommended_week_dfs.sort(
            key=lambda df: (
                day_order_index.get(df["day_of_week"].iloc[0], 100),
                df["hour"].iloc[0],
            )
        )

        # Combine the recommended week dfs into a single dataframe and return
        return pd.concat(recommended_week_dfs, ignore_index=True)

    # Create optimized weekly day/hour combinations by exercise category
    def optimize_by_exercise_category(df, user_exercise_categories):
        recommended_category_dfs = []
        # For each exercise category, get the optimal weekly day/hour combinations
        for category in user_exercise_categories:
            category_df = df[
                df["category_list"].apply(lambda lst: category in lst)
            ].copy()
            if category_df.empty:
                continue
            category_df["optimized_activity_or_exercise_category"] = category
            # Distinguish category-based rows from activity-based rows in the overall summary
            category_df["recommendation_type"] = "exercise_category"
            recommended_category_dfs.append(optimize_week(category_df))
        # Combine the recommended category dfs into a single dataframe and return
        return (
            pd.concat(recommended_category_dfs, ignore_index=True)
            if recommended_category_dfs
            else pd.DataFrame()
        )

    # Create optimized weekly day/hour combinations by activity
    def optimize_by_activity(df, user_activities):
        recommended_activity_dfs = []
        # For each activity, get the optimal weekly day/hour combinations
        for activity in user_activities:
            activity_df = df[
                df["activity_list"].apply(lambda lst: activity in lst)
            ].copy()
            if activity_df.empty:
                continue
            activity_df["optimized_activity_or_exercise_category"] = activity
            # Distinguish activity-based rows from category-based rows in the overall summary
            activity_df["recommendation_type"] = "activity"
            recommended_activity_dfs.append(optimize_week(activity_df))
        # Combine the recommended activity dfs into a single dataframe and return
        return (
            pd.concat(recommended_activity_dfs, ignore_index=True)
            if recommended_activity_dfs
            else pd.DataFrame()
        )

    # Current week: optimize by exercise category and activity
    current_week_exercise_category = optimize_by_exercise_category(
        current_week_forecast, user_exercise_categories
    )
    current_week_activity = optimize_by_activity(current_week_forecast, user_activities)
    # Combine the exercise category and activity dataframes to get the recommended current week forecast
    recommended_current_week_forecast = pd.concat(
        [current_week_exercise_category, current_week_activity], ignore_index=True
    )

    # Next week: optimize by exercise category and activity
    next_week_exercise_category = optimize_by_exercise_category(
        next_week_forecast, user_exercise_categories
    )
    next_week_activity = optimize_by_activity(next_week_forecast, user_activities)
    # Combine the exercise category and activity dataframes to get the recommended next week forecast
    recommended_next_week_forecast = pd.concat(
        [next_week_exercise_category, next_week_activity], ignore_index=True
    )
    return recommended_current_week_forecast, recommended_next_week_forecast
