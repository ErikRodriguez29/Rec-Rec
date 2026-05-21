import argparse

from constants import (
    available_activities,
    available_exercise_categories,
    available_facilities,
)

# User input functions


# Get the user's preferred activities and exercise categories
def get_user_preferred_activities_and_exercise_categories(args):
    user_activities, user_exercise_categories = (
        set(args.preferred_activities.split(",") if args.preferred_activities else []),
        set(
            args.preferred_exercise_categories.split(",")
            if args.preferred_exercise_categories
            else []
        ),
    )
    if user_activities == set([]) and user_exercise_categories == set([]):
        print(
            "No preferred activities or exercise categories entered, please enter at least one activity or exercise category"
        )
        exit()
    return user_activities, user_exercise_categories


# Get the user's preferred hours to go to the gym
def get_user_preferred_days_hours(args):
    preferred_days_hours = []
    parts = [
        p.strip()
        for p in args.preferred_days_hours.lower().strip().split(";")
        if p.strip()
    ]
    for day, hours in zip(parts[0::2], parts[1::2]):
        day = day.upper()[0]
        hours = (int(hours.split(",")[0]), int(hours.split(",")[1]))
        preferred_days_hours.append((day, hours))
    return preferred_days_hours


# Get the set of user's unavailable days and hours (this will be gotten from google calendar integration from the frontend, or otherwise manually typed)
def get_user_unavailable_days_hours(args):
    unavailable_days_hours = []
    parts = [
        p.strip()
        for p in args.unavailable_days_hours.lower().strip().split(";")
        if p.strip()
    ]
    for day, hours in zip(parts[0::2], parts[1::2]):
        day = day.upper()[0]
        hours = (int(hours.split(",")[0]), int(hours.split(",")[1]))
        unavailable_days_hours.append((day, hours))
    return unavailable_days_hours


# Get the user's preferred facilities
def get_user_preferred_facilities(args):
    return {p.strip() for p in args.preferred_facilities.split(";") if p.strip()}


def get_user_preferred_facilities_hard_filter(args):
    return (
        args.preferred_facilities_hard_filter == "yes"
        or args.preferred_facilities_hard_filter == "y"
    )


def get_user_rain_filter(args):
    return args.rain_filter == "yes" or args.rain_filter == "y"


# Gather input from the command line
def invoke_argparse():
    parser = argparse.ArgumentParser(
        description="Recommend Recreation Center gym times based on user preferences.",
        epilog=(
            "Available facilities:\n"
            + "\n".join(f"- {facility}" for facility in available_facilities)
            + "\nAvailable activities:\n"
            + "\n".join(f"- {activity}" for activity in available_activities)
            + "\nAvailable exercise categories:\n"
            + "\n".join(f"- {category}" for category in available_exercise_categories)
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--preferred-activities",
        type=str,
        help="Enter the activities you are interested in (comma separated) (Either enter activities or exercise categories, or both, do not leave both blank). See available activities below.",
        required=False,
    )
    parser.add_argument(
        "--preferred-exercise-categories",
        type=str,
        help="Enter the exercise categories you are interested in (comma separated) (Either enter activities or exercise categories, or both, do not leave both blank). See available exercise categories below.",
        required=False,
    )
    parser.add_argument(
        "--preferred-days-hours",
        type=str,
        help='Enter the days and hours you prefer to go (semicolon separated) (day; hour range (min, max)), leave blank if you are not interested in any days or hours (example: "m; 6, 11; t; 6, 11" for Monday 6am - 11am and Tuesday 6am - 11am)',
        required=False,
        default="None",
    )
    parser.add_argument(
        "--unavailable-days-hours",
        type=str,
        help='Enter the days and hours you are unavailable (semicolon separated) (day; hour range (min, max)) (example: "t; 10, 12; s; 9, 12" for Tuesday 10am - 12pm and Saturday 9am - 12pm)',
        required=True,
        default="None",
    )
    parser.add_argument(
        "--preferred-facilities",
        type=str,
        help="Facilities you prefer: semicolon-separated. Leave blank if none. See available facilities below.",
        required=False,
        default="None",
    )
    parser.add_argument(
        "--rain-filter",
        type=str,
        help="Enter whether rain is a hard filter for you (enter yes if you strictly prefer to go to the gym when not raining) (yes/no)",
        required=False,
        default="no",
    )
    parser.add_argument(
        "--preferred-facilities-hard-filter",
        type=str,
        help="Enter whether preferred facilities is a hard filter for you (enter yes if you strictly prefer to go to the gym at your preferred facilities) (yes/no)",
        required=False,
        default="no",
    )
    args = parser.parse_args()
    return args
