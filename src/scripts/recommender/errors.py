from enum import Enum


class RecommendationErrorCode(str, Enum):
    RAIN_HARD_FILTER = "rain_hard_filter"
    PREFERRED_FACILITIES_HARD_FILTER = "preferred_facilities_hard_filter"
    NO_AVAILABLE_SLOTS = "no_available_slots"


class RecommendationError(Exception):
    def __init__(self, code: RecommendationErrorCode, message: str, *, week: str | None = None):
        self.code = code
        self.week = week
        super().__init__(message)


def build_error_json(error: RecommendationError) -> dict:
    payload = {
        "ok": False,
        "error": {
            "code": error.code.value,
            "message": str(error),
        },
    }
    if error.week is not None:
        payload["error"]["week"] = error.week
    return payload
