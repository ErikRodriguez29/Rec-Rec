# Filtering functions

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
    result = df.loc[is_matching_activity | is_matching_category]
    if result.empty:
        print(
            "No recommendations found, reason: there are no matching activities or exercise categories"
        )
        return None
    return result


# Remove only rows that are both outdoor and raining (keep indoor; keep outdoor when dry)
def filter_outdoor_facilities(df):
    outdoor = df["is_outdoor_facility"] == True
    raining = df["is_raining"] == True
    result = df.loc[~(outdoor & raining)]
    if result.empty:
        print(
            "No recommendations found, reason: there are no outdoor facilities available when raining"
        )
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
        print(
            "No recommendations found, reason: rain is a hard filter and there is no available time when not raining"
        )
        return None
    return result


# Filter the forecast to remove facilities that are not preferred by the user if the user has a hard filter for preferred facilities
def filter_preferred_facilities(df, preferred_facilities_hard_filter):
    result = (
        df.loc[df["is_preferred_facility"] == True]
        if preferred_facilities_hard_filter
        else df
    )
    if result.empty:
        print(
            "No recommendations found, reason: preferred facilities is a hard filter and there are no preferred facilities found with matching exercise categories and activities or no preferred facilities listed"
        )
        return None
    return result


# Filter the forecast to remove unavailable days and hours
def filter_unavailable_days_hours(df, unavailable_days_hours):
    for day, hours in unavailable_days_hours:
        df = df.loc[
            (df["day_of_week"] != day)
            | (df["hour"] < hours[0])
            | (df["hour"] > hours[1])
        ]
    if df.empty:
        print("No recommendations found, reason: there are no available days and hours")
        return None
    return df


# Add a boolean indicating whether the facility is preferred by the user
def augment_with_preferred_facilities(df, preferred_facilities):
    output = df.copy()
    output["is_preferred_facility"] = output["facility_name"].isin(preferred_facilities)
    return output
