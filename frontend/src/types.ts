export type DayCode = "M" | "T" | "W" | "R" | "F" | "S" | "U";

export type SlotState = "preferred" | "unavailable";

export interface DayHourEntry {
  day: DayCode;
  startHour: number;
  endHour: number;
}

export interface UserPreferences {
  preferredActivities: string[];
  preferredExerciseCategories: string[];
  preferredDaysHours: DayHourEntry[];
  unavailableDaysHours: DayHourEntry[];
  preferredFacilities: string[];
  rainFilter: boolean;
  preferredFacilitiesHardFilter: boolean;
}

export interface FacilityTimeRec {
  facility: string;
  times: string[];
  score: number;
}

export interface DayRec {
  day: string;
  facilities: FacilityTimeRec[];
}

export interface CategoryRec {
  category: string;
  days: DayRec[];
}

export interface OverallRec {
  day: string;
  facility: string;
  time: string;
  category: string;
  score: number;
}

export interface WeekRecs {
  categories: CategoryRec[];
  overall: OverallRec[];
}

export interface RecommendationResult {
  currentWeek: WeekRecs;
  nextWeek: WeekRecs;
}

export interface RecommendationFailure {
  code?: string;
  userMessage: string;
}
