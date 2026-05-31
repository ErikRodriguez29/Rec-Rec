import type {
  RecommendationResult,
  WeekRecs,
  CategoryRec,
  FacilityTimeRec,
  OverallRec,
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
  type: string;
  schedule: BackendScheduleDay[];
}

interface BackendOverall {
  day: string;
  activity_or_category: string;
  type: string;
  facility_name: string;
  time_of_day: string;
}

interface BackendWeek {
  by_category: BackendCategory[];
  overall: BackendOverall[];
}

export interface BackendJSON {
  current_week: BackendWeek;
  next_week: BackendWeek;
}

function buildScoreLookup(
  categories: BackendCategory[],
): Map<string, Map<string, Map<string, number>>> {
  const lookup = new Map<string, Map<string, Map<string, number>>>();
  for (const cat of categories) {
    const dayMap = new Map<string, Map<string, number>>();
    for (const schedDay of cat.schedule) {
      const facilityMap = new Map<string, number>();
      for (const opt of schedDay.options) {
        if (!facilityMap.has(opt.facility_name)) {
          facilityMap.set(opt.facility_name, opt.score);
        }
      }
      dayMap.set(schedDay.day, facilityMap);
    }
    lookup.set(cat.id, dayMap);
  }
  return lookup;
}

function adaptWeek(week: BackendWeek): WeekRecs {
  const scoreLookup = buildScoreLookup(week.by_category);

  const categories: CategoryRec[] = week.by_category.map((cat) => ({
    category: cat.label,
    days: cat.schedule.map((schedDay) => {
      const facilityMap = new Map<string, FacilityTimeRec>();
      for (const opt of schedDay.options) {
        if (!facilityMap.has(opt.facility_name)) {
          facilityMap.set(opt.facility_name, {
            facility: opt.facility_name,
            times: [opt.time_of_day],
            score: opt.score,
          });
        } else {
          facilityMap.get(opt.facility_name)!.times.push(opt.time_of_day);
        }
      }
      return { day: schedDay.day, facilities: Array.from(facilityMap.values()) };
    }),
  }));

  const overall: OverallRec[] = week.overall.map((o) => {
    const score = scoreLookup.get(o.activity_or_category)?.get(o.day)?.get(o.facility_name) ?? 0;
    return {
      day: o.day,
      facility: o.facility_name,
      time: o.time_of_day,
      category: o.activity_or_category,
      score,
    };
  });

  return { categories, overall };
}

export function adaptRecommendations(raw: BackendJSON): RecommendationResult {
  return {
    currentWeek: adaptWeek(raw.current_week),
    nextWeek: adaptWeek(raw.next_week),
  };
}
