from build_recommendations import optimize_days_and_hours
from constants import (
    current_week_save_path,
    ensure_parent_dir,
    next_week_save_path,
    recommendations_week_path,
    use_hard_coded_save_paths,
)
from filtering import (
    augment_with_preferred_days_hours,
    augment_with_preferred_facilities,
    filter_matching_preferences,
    filter_outdoor_facilities,
    filter_preferred_facilities,
    filter_rain,
    filter_unavailable_days_hours,
)
from user_input import (
    get_user_preferred_activities_and_exercise_categories,
    get_user_preferred_days_hours,
    get_user_preferred_facilities,
    get_user_preferred_facilities_hard_filter,
    get_user_rain_filter,
    get_user_unavailable_days_hours,
)

# Recommender functions


# Save the current and next week forecasts to a CSV file
def save_data(
    current_week_forecast, next_week_forecast, current_week_number, next_week_number
):
    if use_hard_coded_save_paths:
        current_path = current_week_save_path
        next_path = next_week_save_path
    else:
        current_path = recommendations_week_path(
            current_week_number, "forecast_values_filtered.csv"
        )
        next_path = recommendations_week_path(
            next_week_number, "forecast_values_filtered.csv"
        )
    ensure_parent_dir(current_path)
    ensure_parent_dir(next_path)
    current_week_forecast.to_csv(current_path, index=False)
    next_week_forecast.to_csv(next_path, index=False)


# Recommend times
def recommend_times(
    args,
    current_week_forecast,
    next_week_forecast,
    current_week_number,
    next_week_number,
):
    # Get the user's preferences from the command line
    user_activities, user_exercise_categories = (
        get_user_preferred_activities_and_exercise_categories(args)
    )
    preferred_days_hours = get_user_preferred_days_hours(args)
    unavailable_days_hours = get_user_unavailable_days_hours(args)
    preferred_facilities = get_user_preferred_facilities(args)
    rain_filter = get_user_rain_filter(args)
    preferred_facilities_hard_filter = get_user_preferred_facilities_hard_filter(args)
    # Filtering

    # Filter the current and next week forecasts to only include activities and exercise categories that the user is interested in
    current_week_forecast = filter_matching_preferences(
        current_week_forecast, user_activities, user_exercise_categories
    )
    next_week_forecast = filter_matching_preferences(
        next_week_forecast, user_activities, user_exercise_categories
    )
    # Filter the current and next week forecasts to eliminate outdoor facilities when it is raining
    current_week_forecast = filter_outdoor_facilities(current_week_forecast)
    next_week_forecast = filter_outdoor_facilities(next_week_forecast)
    # Filter the current and next week forecasts to remove rows where it is raining if the user has a hard filter for rain
    current_week_forecast = filter_rain(
        current_week_forecast, rain_filter, week="current"
    )
    next_week_forecast = filter_rain(
        next_week_forecast, rain_filter, week="next"
    )
    # Augment the current and next week forecasts with the user's preferred hours
    current_week_forecast = augment_with_preferred_days_hours(
        current_week_forecast, preferred_days_hours
    )
    next_week_forecast = augment_with_preferred_days_hours(
        next_week_forecast, preferred_days_hours
    )
    # Filter the current and next week forecasts to remove unavailable days and hours
    current_week_forecast = filter_unavailable_days_hours(
        current_week_forecast, unavailable_days_hours, week="current"
    )
    next_week_forecast = filter_unavailable_days_hours(
        next_week_forecast, unavailable_days_hours, week="next"
    )
    # Augment the current and next week forecasts with the user's preferred facilities
    current_week_forecast = augment_with_preferred_facilities(
        current_week_forecast, preferred_facilities
    )
    next_week_forecast = augment_with_preferred_facilities(
        next_week_forecast, preferred_facilities
    )
    # Filter the current and next week forecasts to remove facilities that are not preferred by the user if the user has a hard filter for preferred facilities
    current_week_forecast = filter_preferred_facilities(
        current_week_forecast, preferred_facilities_hard_filter, week="current"
    )
    next_week_forecast = filter_preferred_facilities(
        next_week_forecast, preferred_facilities_hard_filter, week="next"
    )

    save_data(
        current_week_forecast, next_week_forecast, current_week_number, next_week_number
    )

    # Recommendations

    current_week_recommendations, next_week_recommendations = optimize_days_and_hours(
        current_week_forecast,
        next_week_forecast,
        user_exercise_categories,
        user_activities,
    )
    # Drop the columns not needed for cleaner output
    current_week_recommendations = current_week_recommendations.drop(
        columns=[
            "predicted_count",
            "is_outdoor_facility",
            "categories",
            "activities",
            "activity_list",
            "category_list",
        ]
    )
    next_week_recommendations = next_week_recommendations.drop(
        columns=[
            "predicted_count",
            "is_outdoor_facility",
            "categories",
            "activities",
            "activity_list",
            "category_list",
        ]
    )
    # Return the current and next week recommendations
    return current_week_recommendations, next_week_recommendations
