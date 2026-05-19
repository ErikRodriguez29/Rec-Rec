# UCSB Recreation Center Recommender

The UCSB Recreation Center Recommender is a pipeline that forecasts Rec Cen facility occupancy and recommends gym times based on user preferred activities, exercise categories, schedule, and facilities. The recommender system does the following:

1. Collects live facility counts from [UCSB Recreation live counts](https://recreation.ucsb.edu/facilities/livecount) using `facility-counts.py`
2. Models and predicts attendance patterns at each facility for the current and next week (`EDA.R` → `Training.R` → `Predictions.R`).
3. Recommends personalized weekly times to go to the gym that minimizes attendance while respecting user preferences, maximizing the chances of the user finding their preferred machines for their workout routines (`scripts/recommender/recommend-times.py`).
4. Presents the user a survey to collect their preferences and displays their recommendations in a frontend website (in progress).

## Setup

### Data

Place your dataset on `facility_counts.csv` in the `data/` folder. A dataset can be retrieved using the python script:

```bash
python scripts/facility-counts.py
```
### Forecast data generation

From the `scripts/` directory, run in order: `EDA.R` → `Training.R` → `Predictions.R`

**Outputs:** where n is the week number since the starting week from Janurary 26, 2026:
- `EDA/Week {n}/*.png`: heatmaps showing occupancy patterns in the Rec Cen
- `tuned_models/Week {n}/final_attendance_workflow.rds`: the trained model
- `tuned_models/Week {n}/race_results_autoplot.png`: a plot of the model tuning results
- `predictions/Week {n}/forecast_values.csv`: raw forecasted attendance for both the current and next week (output to both forecasted weeks `predictions/Week {n}/` and `predictions/Week {n+1}/`)

### Running the recommender

To run the recommender help menu, cd into the `scripts/recommender/` directory and run:
```bash
pip install -r requirements.txt
python recommend-times.py -h
```

Example commands can be found at [`scripts/recommender/example_commands.md`](scripts/recommender/example_commands.md).

**Outputs**:

- `scripts/recommender/recommendations.json`: JSON structured output for a frontend. See `scripts/recommender/example_recommendations.json` for an example of the JSON structure.
- `scripts/recommender/recommendations.txt`: human-readable summary
- `predictions/Week {n}/forecast_values_filtered.csv`: user filtered forecasted attendance (output to both forecasted weeks `predictions/Week {n}/` and `predictions/Week {n+1}/`) to be used for scoring
- `predictions/Week {n}/recommendations.csv`: per-week recommendation tables

### Testing with fixed weeks

In `scripts/recommender/constants.py`, set `use_hard_coded_load_paths`, `use_hard_coded_save_paths`, and/or `use_hard_coded_recommendations_save_paths` to `True` to pin inputs/outputs to specific paths paths instead of the calendar-derived current/next week.

## Project layout

```
data/                  # facility_counts.csv (and related files)
predictions/Week {n}/  # forecast_values.csv, recommendations.csv, ...
scripts/
  EDA.R
  Training.R
  Predictions.R
  facility-counts.py
  recommender/         # Python recommender modules + recommend-times.py
tuned_models/          # saved R model workflows (from Training.R)
```

For more details on the scripts, see: [`scripts/README.md`](scripts/README.md).
