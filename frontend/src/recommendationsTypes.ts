export type RecommendationOption = {
  facility_name: string;
  time_of_day: string;
  score: number;
};

export type DaySchedule = {
  day: string;
  options: RecommendationOption[];
};

export type CategoryRecommendations = {
  id: string;
  label: string;
  type: "activity" | "exercise_category";
  schedule: DaySchedule[];
};

export type OverallRecommendation = {
  day: string;
  activity_or_category: string;
  type: "activity" | "exercise_category";
  facility_name: string;
  time_of_day: string;
};

export type WeekRecommendations = {
  by_category: CategoryRecommendations[];
  overall: OverallRecommendation[];
};

export type RecommendationsPayload = {
  current_week: WeekRecommendations;
  next_week: WeekRecommendations;
};

export function isRecommendationsPayload(value: unknown): value is RecommendationsPayload {
  if (value === null || typeof value !== "object") return false;
  const root = value as Record<string, unknown>;
  return isWeekRecommendations(root.current_week) && isWeekRecommendations(root.next_week);
}

function isWeekRecommendations(value: unknown): value is WeekRecommendations {
  if (value === null || typeof value !== "object") return false;
  const week = value as Record<string, unknown>;
  return Array.isArray(week.by_category) && Array.isArray(week.overall);
}
