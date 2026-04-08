# Scripts

- EDA.R: Generates heatmaps showing occupancy patterns in the Rec Cen under EDA/Week x/ (Where x is the week number since the starting week from Janurary 26, 2026)
- Training.R: Trains both boosted and random forest models and picks the best of the two and saves the workflow to tuned_models/Week x/final_attendance_workflow.rds
- Predictions.R: Generates predictions and heatmaps under predictions/Week x/
- facility-counts.py is the script I have running constantly which scrapes the data from https://recreation.ucsb.edu/facilities/livecount