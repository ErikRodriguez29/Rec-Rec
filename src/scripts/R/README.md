# R pipeline

Run from this directory (`src/scripts/R/`) so relative paths resolve to `src/data/`, `src/predictions/`, etc.

- `EDA.R` — heatmaps under `../../EDA/Week {n}/`
- `Training.R` — tuned workflow under `../../tuned_models/Week {n}/`
- `Predictions.R` — forecasts under `../../predictions/Week {n}/`

Install dependencies: `renv::restore()` (uses `renv.lock` in this folder).
