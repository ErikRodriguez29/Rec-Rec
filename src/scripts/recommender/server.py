from argparse import Namespace
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from data_preprocessing import get_current_next_week_numbers, load_data
from errors import RecommendationError, build_error_json
from output_formatting import build_recommendations_json
from recommender import recommend_times

# The existing recommender paths are relative to this folder.
RECOMMENDER_DIR = Path(__file__).resolve().parent
os.chdir(RECOMMENDER_DIR)


class DayHourEntry(BaseModel):
    day: str
    startHour: int
    endHour: int


class UserPreferences(BaseModel):
    preferredActivities: list[str] = Field(default_factory=list)
    preferredExerciseCategories: list[str] = Field(default_factory=list)
    preferredDaysHours: list[DayHourEntry] = Field(default_factory=list)
    unavailableDaysHours: list[DayHourEntry] = Field(default_factory=list)
    preferredFacilities: list[str] = Field(default_factory=list)
    rainFilter: bool = False
    preferredFacilitiesHardFilter: bool = False


app = FastAPI(title="Rec-Rec Recommendations API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def format_days_hours(entries: list[DayHourEntry]) -> str:
    return "; ".join(
        f"{entry.day.lower()}; {entry.startHour}, {entry.endHour}" for entry in entries
    )


def preferences_to_args(prefs: UserPreferences) -> Namespace:
    return Namespace(
        preferred_activities=",".join(prefs.preferredActivities),
        preferred_exercise_categories=",".join(prefs.preferredExerciseCategories),
        preferred_days_hours=format_days_hours(prefs.preferredDaysHours),
        unavailable_days_hours=format_days_hours(prefs.unavailableDaysHours),
        preferred_facilities=";".join(prefs.preferredFacilities),
        rain_filter="yes" if prefs.rainFilter else "no",
        preferred_facilities_hard_filter=(
            "yes" if prefs.preferredFacilitiesHardFilter else "no"
        ),
    )


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/api/recommendations")
def get_recommendations(prefs: UserPreferences) -> dict:
    try:
        current_week_number, next_week_number = get_current_next_week_numbers()
        current_week_forecast, next_week_forecast = load_data(
            current_week_number, next_week_number
        )
        current_week_recommendations, next_week_recommendations = recommend_times(
            preferences_to_args(prefs),
            current_week_forecast,
            next_week_forecast,
            current_week_number,
            next_week_number,
        )
        return build_recommendations_json(
            current_week_recommendations,
            next_week_recommendations,
        )
    except RecommendationError as error:
        return build_error_json(error)
    except FileNotFoundError as error:
        return {
            "ok": False,
            "error": {
                "code": "missing_forecast_data",
                "message": f"Missing forecast data file: {error.filename}",
            },
        }
