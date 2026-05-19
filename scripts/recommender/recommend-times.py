from constants import (
    current_week_recommendations_save_path,
    next_week_recommendations_save_path,
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
    current_week_forecast, next_week_forecast = load_data(current_week_number, next_week_number)
    # Recommend the times
    current_week_recommendations, next_week_recommendations = recommend_times(
        args, current_week_forecast, next_week_forecast, current_week_number, next_week_number
    )
    if current_week_recommendations is None or next_week_recommendations is None:
        print("No recommendations found for current week or next week!")
        return
    # Save the recommendations to CSV files
    if use_hard_coded_recommendations_save_paths:
        current_week_recommendations.to_csv(current_week_recommendations_save_path, index=False)
        next_week_recommendations.to_csv(next_week_recommendations_save_path, index=False)
    else:
        current_week_recommendations.to_csv(f"../../predictions/Week {current_week_number}/recommendations.csv", index=False)
        next_week_recommendations.to_csv(f"../../predictions/Week {next_week_number}/recommendations.csv", index=False)
    print(f"Recommended times saved to CSV files")

    recommendations_json = build_recommendations_json(
        current_week_recommendations,
        next_week_recommendations,
    )
    save_recommendations_json(recommendations_json, "recommendations.json")
    print("Recommended times saved to recommendations.json")

    # Print the set of formatted recommendations
    formatted_recommendations_to_print = format_recommendations_to_print(current_week_recommendations, next_week_recommendations)
    print(formatted_recommendations_to_print)

    # Save the formatted recommendations to a text file
    with open("recommendations.txt", "w") as f:
        f.write(formatted_recommendations_to_print)

if __name__ == "__main__":
    main()
