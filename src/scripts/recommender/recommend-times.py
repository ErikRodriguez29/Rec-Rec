from constants import (
    RECOMMENDATIONS_JSON_PATH,
    RECOMMENDATIONS_TXT_PATH,
    current_week_recommendations_save_path,
    ensure_parent_dir,
    next_week_recommendations_save_path,
    recommendations_week_path,
    use_hard_coded_recommendations_save_paths,
)
from data_preprocessing import get_current_next_week_numbers, load_data
from output_formatting import (
    build_recommendations_json,
    format_recommendations_to_print,
    save_recommendations_json,
)
from recommender import recommend_times
from user_input import invoke_argparse


def main():
    # Get the user's preferences from the command line
    args = invoke_argparse()

    # Get the current and next week numbers
    current_week_number, next_week_number = get_current_next_week_numbers()
    # Load the current and next week forecast data
    current_week_forecast, next_week_forecast = load_data(
        current_week_number, next_week_number
    )
    # Recommend the times
    current_week_recommendations, next_week_recommendations = recommend_times(
        args,
        current_week_forecast,
        next_week_forecast,
        current_week_number,
        next_week_number,
    )
    # Save the recommendations to CSV files
    if use_hard_coded_recommendations_save_paths:
        current_path = current_week_recommendations_save_path
        next_path = next_week_recommendations_save_path
    else:
        current_path = recommendations_week_path(current_week_number)
        next_path = recommendations_week_path(next_week_number)
    ensure_parent_dir(current_path)
    ensure_parent_dir(next_path)
    current_week_recommendations.to_csv(current_path, index=False)
    next_week_recommendations.to_csv(next_path, index=False)
    print(f"Recommended times saved to CSV files")

    recommendations_json = build_recommendations_json(
        current_week_recommendations,
        next_week_recommendations,
    )
    ensure_parent_dir(RECOMMENDATIONS_JSON_PATH)
    save_recommendations_json(recommendations_json, RECOMMENDATIONS_JSON_PATH)
    print(f"Recommended times saved to {RECOMMENDATIONS_JSON_PATH}")

    # Print the set of formatted recommendations
    formatted_recommendations_to_print = format_recommendations_to_print(
        current_week_recommendations, next_week_recommendations
    )
    print(formatted_recommendations_to_print)

    # Save the formatted recommendations to a text file
    ensure_parent_dir(RECOMMENDATIONS_TXT_PATH)
    with open(RECOMMENDATIONS_TXT_PATH, "w", encoding="utf-8") as f:
        f.write(formatted_recommendations_to_print)


if __name__ == "__main__":
    main()
