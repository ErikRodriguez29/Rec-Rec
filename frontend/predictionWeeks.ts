/** Matches `get_current_next_week_numbers()` in src/scripts/recommender/data_preprocessing.py */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Monday 00:00 local time for the calendar week containing `date`. */
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

const ANCHOR_MONDAY = mondayOf(new Date(2026, 0, 16));

export function getCurrentNextWeekNumbers(now = new Date()): {
  currentWeek: number;
  nextWeek: number;
} {
  const monday = mondayOf(now);
  const daysSinceAnchor = Math.floor((monday.getTime() - ANCHOR_MONDAY.getTime()) / MS_PER_DAY);
  const weekNo = Math.floor(daysSinceAnchor / 7) - 1;
  return { currentWeek: weekNo, nextWeek: weekNo + 1 };
}

/** Week folder index for `src/output/predictions/Week {n}/` heatmap PNGs (recommender week + 1). */
export function getForecastHeatmapWeekNumbers(now = new Date()): {
  currentWeek: number;
  nextWeek: number;
} {
  const weeks = getCurrentNextWeekNumbers(now);
  return { currentWeek: weeks.currentWeek + 1, nextWeek: weeks.nextWeek + 1 };
}
