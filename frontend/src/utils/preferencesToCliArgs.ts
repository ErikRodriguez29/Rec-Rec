import type { DayHourEntry, UserPreferences } from "../types";

/** Format day/hour ranges for recommend-times.py (--preferred-days-hours, --unavailable-days-hours). */
export function formatDaysHours(entries: DayHourEntry[]): string {
  if (entries.length === 0) return "";
  return entries
    .map(({ day, startHour, endHour }) => `${day.toLowerCase()}; ${startHour}, ${endHour}`)
    .join("; ");
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

/**
 * Build argv flags for recommend-times.py from frontend preferences.
 */
export function preferencesToCliArgs(prefs: UserPreferences): string[] {
  const args: string[] = [];

  if (prefs.preferredActivities.length > 0) {
    args.push("--preferred-activities", prefs.preferredActivities.join(","));
  }
  if (prefs.preferredExerciseCategories.length > 0) {
    args.push("--preferred-exercise-categories", prefs.preferredExerciseCategories.join(","));
  }

  const preferredDaysHours = formatDaysHours(prefs.preferredDaysHours);
  if (preferredDaysHours) {
    args.push("--preferred-days-hours", preferredDaysHours);
  }

  const unavailableDaysHours = formatDaysHours(prefs.unavailableDaysHours);
  if (unavailableDaysHours) {
    args.push("--unavailable-days-hours", unavailableDaysHours);
  }

  if (prefs.preferredFacilities.length > 0) {
    args.push("--preferred-facilities", prefs.preferredFacilities.join(";"));
  } else {
    args.push("--preferred-facilities", "");
  }

  args.push("--rain-filter", yesNo(prefs.rainFilter));
  args.push("--preferred-facilities-hard-filter", yesNo(prefs.preferredFacilitiesHardFilter));

  return args;
}
