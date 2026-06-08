import axios from "axios";
import type {
  CategoryRec,
  FacilityTimeRec,
  OverallRec,
  RecommendationResult,
  UserPreferences,
  WeekRecs,
} from "../types";

interface BackendOption {
  facility_name: string;
  time_of_day: string;
  score: number;
}

interface BackendScheduleDay {
  day: string;
  options: BackendOption[];
}

interface BackendCategory {
  id: string;
  label: string;
  schedule: BackendScheduleDay[];
}

interface BackendOverall {
  day: string;
  activity_or_category: string;
  facility_name: string;
  time_of_day: string;
}

interface BackendWeek {
  by_category: BackendCategory[];
  overall: BackendOverall[];
}

interface BackendSuccess {
  ok?: true;
  current_week: BackendWeek;
  next_week: BackendWeek;
}

interface BackendFailure {
  ok: false;
  error?: {
    message?: string;
  };
}

type BackendResponse = BackendSuccess | BackendFailure;

export class RecommendationsApiError extends Error {
  constructor(message = "Could not get recommendations.") {
    super(message);
    this.name = "RecommendationsApiError";
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_RECOMMENDATIONS_API_URL ?? "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

function buildScoreLookup(
  categories: BackendCategory[],
): Map<string, Map<string, Map<string, number>>> {
  const lookup = new Map<string, Map<string, Map<string, number>>>();

  for (const category of categories) {
    const dayMap = new Map<string, Map<string, number>>();
    for (const day of category.schedule) {
      const facilityMap = new Map<string, number>();
      for (const option of day.options) {
        if (!facilityMap.has(option.facility_name)) {
          facilityMap.set(option.facility_name, option.score);
        }
      }
      dayMap.set(day.day, facilityMap);
    }
    lookup.set(category.id, dayMap);
  }

  return lookup;
}

function normalizeWeek(week: BackendWeek): WeekRecs {
  const scores = buildScoreLookup(week.by_category);

  const categories: CategoryRec[] = week.by_category.map((category) => ({
    category: category.label,
    days: category.schedule.map((day) => {
      const facilities = new Map<string, FacilityTimeRec>();

      for (const option of day.options) {
        const existing = facilities.get(option.facility_name);
        if (existing) {
          existing.times.push(option.time_of_day);
        } else {
          facilities.set(option.facility_name, {
            facility: option.facility_name,
            times: [option.time_of_day],
            score: option.score,
          });
        }
      }

      return { day: day.day, facilities: Array.from(facilities.values()) };
    }),
  }));

  const overall: OverallRec[] = week.overall.map((item) => ({
    day: item.day,
    facility: item.facility_name,
    time: item.time_of_day,
    category: item.activity_or_category,
    score: scores.get(item.activity_or_category)?.get(item.day)?.get(item.facility_name) ?? 0,
  }));

  return { categories, overall };
}

function normalizeRecommendations(payload: BackendSuccess): RecommendationResult {
  return {
    currentWeek: normalizeWeek(payload.current_week),
    nextWeek: normalizeWeek(payload.next_week),
  };
}

export async function getRecommendations(prefs: UserPreferences): Promise<RecommendationResult> {
  const { data } = await api.post<BackendResponse>("/recommendations", prefs);

  if (data.ok === false) {
    throw new RecommendationsApiError(data.error?.message);
  }

  return normalizeRecommendations(data);
}
