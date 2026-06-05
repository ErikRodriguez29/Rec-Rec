# UCSB Recreation Center Recommender

The UCSB Recreation Center Recommender is a pipeline that forecasts Recreation Center facility occupancy and builds personalized recommended weekly schedules to go to the gym based on user preferred activities, exercise categories, schedule, and facilities. The pipeline does the following:

1. Collects live facility counts from [UCSB Recreation live counts](https://recreation.ucsb.edu/facilities/livecount) using `facility-counts.py`.
2. Models and predicts attendance patterns at each facility for the current and next week (`EDA.R`,`Training.R`, `Predictions.R`).
3. Recommends personalized weekly times to go to the gym that minimizes attendance while respecting user preferences, maximizing the chances of the user finding their preferred machines for their workout routines (`recommend-times.py`).
4. Presents the user a survey to collect their preferences and displays their recommendations in a frontend website (`frontend/`).

## Instructions for Setup

### Data

Place your dataset on `facility_counts.csv` in the `src/data/` folder. A dataset can be retrieved using the python script:

```bash
python src/scripts/facility-counts.py
```

### Set your start date
Set your start date in your .env file to the earliest day in your dataset in YYYY-MM-DD format. Note this defaults to 2026-01-26 if no value is set.
```.env
START_DATE=YYYY-MM-DD
```
### Forecast data generation

From `src/scripts/`, install the required packages with `renv::restore()`, then run the following scripts in 
order: `EDA.R`, `Training.R`, `Predictions.R`

Install the required packages:
```bash
renv::restore()
```

Generate the EDA plots:
```bash
Rscript src/scripts/R/EDA.R
```

Train a model:
```bash
Rscript src/scripts/R/Training.R
```

Generate predictions:
```bash
Rscript src/scripts/R/Predictions.R
```

**Outputs:** where n is the week number since the starting week from `START_DATE` (where the first week, n=1) (set this in your .env file):

`EDA.R`:
- `src/output/EDA/Week {n}/*.png`: heatmaps showing occupancy patterns in the Rec Cen

`Training.R`:
- `src/output/tuned_models/Week {n}/final_attendance_workflow.rds`: the trained model
- `src/output/tuned_models/Week {n}/race_results_autoplot.png`: a plot of the model tuning results
- `src/output/tuned_models/Week {n}/race_results.csv`: a CSV of the model tuning results
- `src/output/tuned_models/Week {n}/race_results.txt`: a text version of the race_results.csv file

`Predictions.R`:
- `src/output/predictions/Week {n}/forecast_values.csv`: raw forecasted attendance for both the current and next week (output to both forecasted weeks `src/output/predictions/Week {n}/` and `src/output/predictions/Week {n+1}/`)
- `src/output/predictions/Week {n}/*.png`: heatmaps showing occupancy patterns in the Rec Cen from the created facility categories

### Running the recommender

To run the recommender help menu, run the following from `src/scripts/recommender`:
```bash
pip install -r requirements.txt
python recommend-times.py -h
```

Example commands can be found in [`src/scripts/recommender/example_commands.md`](src/scripts/recommender/example_commands.md).

**Outputs**:

- `src/output/recommendations/Week {n}/forecast_values_filtered.csv`: user filtered forecasted attendance (output to both forecasted weeks `src/output/recommendations/Week {n}/` and `src/output/recommendations/Week {n+1}/`) to be used for scoring
- `src/output/recommendations/Week {n}/recommendations.csv`: per-week recommendation tables
- `src/output/recommendations/recommendations.json`: JSON structured output for a frontend. See [`src/output/recommendations/example_recommendations.json`](src/output/recommendations/example_recommendations.json) for an example of the JSON structure. See [`src/output/recommendations/example_error_recommendations.json`](src/output/recommendations/example_error_recommendations.json) for an example of the JSON structure when an error occurs. All error messages that can occur are listed in [`src/scripts/recommender/filtering.py`](src/scripts/recommender/filtering.py).
- `src/output/recommendations/recommendations.txt`: Text summary for debugging

### Testing with fixed weeks

In `src/scripts/recommender/constants.py`, set `use_hard_coded_load_paths`, `use_hard_coded_save_paths`, and/or `use_hard_coded_recommendations_save_paths` to `True` to pin inputs/outputs to specific paths paths instead of the calendar-derived current/next week.

### Frontend

The frontend is located in the `frontend/` directory. It is built with Vite+ and TypeScript. It uses the `src/output/recommendations/recommendations.json` file as input to display the recommendations.

To run the frontend, run the following from the `frontend/` directory:
```bash
pnpm install
pnpm run dev
```

### Backend

To run the backend, run the following from the `src/scripts/recommender/` directory:
```bash
pip install "fastapi[standard]"
fastapi dev server.py
```

## Project layout

```
frontend/              # frontend app
src/
  data/                # facility_counts.csv and cached weather data go here
  output/
    EDA/Week {n}/      # saved weekly occupancy plots (from EDA.R)
    tuned_models/      # saved R model workflows (from Training.R)
    predictions/Week {n}/  # forecast_values.csv, prediction heatmaps
    recommendations/   # recommendations.json, recommendations.txt, example_recommendations.json, Week {n}/forecast_values_filtered.csv, recommendations.csv
  scripts/
    R/                   # EDA.R, Training.R, Predictions.R, renv
    facility-counts.py
    recommender/         # Python recommender modules + recommend-times.py, server.py
```

For more details on the scripts, see: [`src/scripts/README.md`](src/scripts/README.md).
