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

/** Second-ranked time for the same activity/category on that day (from by_category options). */
export function getOverallAlternateOption(
  week: WeekRecommendations,
  row: OverallRecommendation,
): RecommendationOption | null {
  const category = week.by_category.find(
    (c) => c.id === row.activity_or_category || c.label === row.activity_or_category,
  );
  if (category === undefined) return null;
  const dayBlock = category.schedule.find((d) => d.day === row.day);
  if (dayBlock === undefined || dayBlock.options.length < 2) return null;
  return dayBlock.options[1] ?? null;
}

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

function collectFacilitiesFromWeek(week: WeekRecommendations, names: Set<string>) {
  for (const row of week.overall) {
    names.add(row.facility_name);
  }
  for (const category of week.by_category) {
    for (const day of category.schedule) {
      for (const option of day.options) {
        names.add(option.facility_name);
      }
    }
  }
}

/** Unique facility names appearing in current- and next-week recommendations. */
export function collectRecommendedFacilityNames(
  payload: RecommendationsPayload,
): ReadonlySet<string> {
  const names = new Set<string>();
  collectFacilitiesFromWeek(payload.current_week, names);
  collectFacilitiesFromWeek(payload.next_week, names);
  return names;
}
