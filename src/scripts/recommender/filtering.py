# Filtering functions

from errors import RecommendationError, RecommendationErrorCode

# Send an error JSON to the recommendations.json file if an exception is raised during filtering detailing the exact process which failed
def send_error_json(code: RecommendationErrorCode, message: str, *, week: str) -> None:
    raise RecommendationError(code, message, week=week)


# Filter the forecast facility data to only include facilites that user would prefer
# by checking if the user's preferred activities and exercise categories are in the category and activity lists
# only remove if neither match
def filter_matching_preferences(df, preferred_activities, preferred_categories):
    is_matching_activity = df["activity_list"].apply(
        lambda lst: bool(preferred_activities & set(lst))
    )
    is_matching_category = df["category_list"].apply(
        lambda lst: bool(preferred_categories & set(lst))
    )
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
def filter_rain(df, rain_filter, *, week: str):
    if not rain_filter:
        return df
    result = df.loc[~(df["is_raining"] == True)] if rain_filter else df
    if not df.empty and result.empty:
        send_error_json(
            RecommendationErrorCode.RAIN_HARD_FILTER,
            "No recommendations found, reason: rain is a hard filter and there is no available time when not raining",
            week=week,
        )
    return result


# Filter the forecast to remove facilities that are not preferred by the user if the user has a hard filter for preferred facilities
def filter_preferred_facilities(df, preferred_facilities_hard_filter, *, week: str):
    if not preferred_facilities_hard_filter:
        return df
    result = df.loc[df["is_preferred_facility"] == True]
    if not df.empty and result.empty:
        send_error_json(
            RecommendationErrorCode.PREFERRED_FACILITIES_HARD_FILTER,
            "No recommendations found, reason: preferred facilities is a hard filter and there are no preferred facilities found with matching exercise categories and activities or no preferred facilities listed",
            week=week,
        )
    return result


# Filter the forecast to remove unavailable days and hours
def filter_unavailable_days_hours(df, unavailable_days_hours, *, week: str):
    if not unavailable_days_hours:
        return df
    result = df
    for day, hours in unavailable_days_hours:
        result = result.loc[
            (result["day_of_week"] != day)
            | (result["hour"] < hours[0])
            | (result["hour"] > hours[1])
        ]
    if not df.empty and result.empty:
        send_error_json(
            RecommendationErrorCode.NO_AVAILABLE_SLOTS,
            "No recommendations found, reason: there are no available days and hours",
            week=week,
        )
    return result


# Add a boolean indicating whether the facility is preferred by the user
def augment_with_preferred_facilities(df, preferred_facilities):
    output = df.copy()
    output["is_preferred_facility"] = output["facility_name"].isin(preferred_facilities)
    return output
