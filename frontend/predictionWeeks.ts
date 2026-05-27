/** Matches `get_week_info()` in `src/scripts/R/utils.R` and Python `get_current_next_week_numbers()`. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DEFAULT_START_DATE = "2026-01-26";

/** Monday 00:00 local time for the calendar week containing `date`. */
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

function resolveStartDateString(startDateIso?: string): string {
  if (startDateIso !== undefined && startDateIso.length > 0) {
    return startDateIso;
  }
  const fromMeta = import.meta.env.START_DATE;
  if (typeof fromMeta === "string" && fromMeta.length > 0) {
    return fromMeta;
  }
  return DEFAULT_START_DATE;
}

function parseStartDateLocal(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function week1MondayFromStartDate(startDateIso?: string): Date {
  return mondayOf(parseStartDateLocal(resolveStartDateString(startDateIso)));
}

export function getCurrentNextWeekNumbers(
  now = new Date(),
  startDateIso?: string,
): {
  currentWeek: number;
  nextWeek: number;
} {
  const week1Monday = week1MondayFromStartDate(startDateIso);
  const monday = mondayOf(now);
  const daysSinceWeek1 = Math.floor((monday.getTime() - week1Monday.getTime()) / MS_PER_DAY);
  const currentWeek = Math.floor(daysSinceWeek1 / 7) + 1;
  return { currentWeek, nextWeek: currentWeek + 1 };
}

/**
 * Week folder index for `src/output/predictions/Week {n}/` heatmap PNGs.
 * Prediction outputs are stored one week ahead of recommender forecast CSV weeks.
 */
export function getForecastHeatmapWeekNumbers(
  now = new Date(),
  startDateIso?: string,
): {
  currentWeek: number;
  nextWeek: number;
} {
  const weeks = getCurrentNextWeekNumbers(now, startDateIso);
  return { currentWeek: weeks.currentWeek + 1, nextWeek: weeks.nextWeek + 1 };
}
