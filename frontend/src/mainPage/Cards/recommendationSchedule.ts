import type { OverallRec, WeekRecs } from "../../types";

function getCategoryDay(recs: WeekRecs, rec: OverallRec) {
  const category = recs.categories.find((item) => item.category === rec.category);
  return category?.days.find((item) => item.day === rec.day);
}

export function getAlternateTime(recs: WeekRecs, rec: OverallRec): string {
  const day = getCategoryDay(recs, rec);
  const times =
    day?.facilities.flatMap((facility) => facility.times.filter((time) => time !== rec.time)) ?? [];

  return times[0] ?? "";
}

export function getFacilityForTime(recs: WeekRecs, rec: OverallRec, time: string): string {
  const day = getCategoryDay(recs, rec);

  for (const facility of day?.facilities ?? []) {
    if (facility.times.includes(time)) return facility.facility;
  }

  return rec.facility;
}

export function getScoreForTime(recs: WeekRecs, rec: OverallRec, time: string): number {
  const day = getCategoryDay(recs, rec);

  for (const facility of day?.facilities ?? []) {
    if (facility.times.includes(time)) return facility.score;
  }

  return rec.score;
}
