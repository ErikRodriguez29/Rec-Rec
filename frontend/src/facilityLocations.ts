export type FacilityLocation = {
  facilities: string;
  /** Preferred-facilities dropdown names covered by this map entry. */
  optionNames: readonly string[];
  mapNumbers: number[];
  note?: string;
};

/** Per-facility activities from `exercise_categories` in `src/scripts/R/Predictions.R`. */
const FACILITY_ACTIVITIES: Readonly<Record<string, readonly string[]>> = {
  "Racquetball Court 1": ["racquetball"],
  "Racquetball Court 2": ["racquetball"],
  "Racquetball Court 3": ["racquetball"],
  "Racquetball Court 4": ["racquetball"],
  "Squash Court 1": ["squash"],
  Galleria: [
    "ellipticals (precor branded machines)",
    "stairmasters (stair machines)",
    "treadmills",
  ],
  "Main Gym Court 1 (North)": ["basketball"],
  "Main Gym Court 2 (South)": ["basketball"],
  "Outdoor Fitness 1 (Turf, Free Weights, Benches)": [
    "benching",
    "bike machines",
    "weight lifting",
  ],
  "Pavilion Court 1 (West)": ["badminton"],
  "Pavilion Court 2 (East)": ["badminton"],
  "Outdoor Fitness 2 (Behind Pottery)": ["bike machines", "ellipticals (precor branded machines)"],
  "FC 1- North Room": ["arm machines", "core machines", "leg presses", "weight lifting"],
  "FC 1 - South Room": ["arm machines", "core machines", "leg presses", "weight lifting"],
  "FC 2 - 1st floor": [
    "arm & leg machines",
    "stairmasters (stair machines)",
    "treadmills",
    "weight crunch machines",
    "weight lifting",
  ],
  "FC 2- Mezzanine": ["ellipticals (precor branded machines)", "treadmills"],
  "FC 3 - MAC": [
    "arm machines",
    "leg presses",
    "treadmills",
    "weight crunch machines",
    "weight lifting",
  ],
  "MAC Court": ["hockey", "skating"],
  Spa: [],
  "Small Pool": ["swimming"],
  "Big Pool": ["swimming"],
  "Climbing Center - MAC": ["climbing"],
};

export function getActivitiesForLocation(entry: FacilityLocation): string[] {
  const activities = new Set<string>();
  for (const facilityName of entry.optionNames) {
    for (const activity of FACILITY_ACTIVITIES[facilityName] ?? []) {
      activities.add(activity);
    }
  }
  return [...activities].sort((a, b) => a.localeCompare(b));
}

export function formatAvailableActivities(activities: readonly string[]): string {
  if (activities.length === 0) return "None listed";
  return activities.join(", ");
}

export const FACILITY_LOCATIONS: FacilityLocation[] = [
  {
    facilities: "Racquetball Courts 1–4 and Squash Court 1",
    optionNames: [
      "Racquetball Court 1",
      "Racquetball Court 2",
      "Racquetball Court 3",
      "Racquetball Court 4",
      "Squash Court 1",
    ],
    mapNumbers: [3],
  },
  { facilities: "Galleria", optionNames: ["Galleria"], mapNumbers: [5] },
  {
    facilities: "Main Gym Court 1 (North) and Main Gym Court 2 (South)",
    optionNames: ["Main Gym Court 1 (North)", "Main Gym Court 2 (South)"],
    mapNumbers: [11],
  },
  {
    facilities: "Outdoor Fitness 1 (Turf, Free Weights, Benches)",
    optionNames: ["Outdoor Fitness 1 (Turf, Free Weights, Benches)"],
    mapNumbers: [10],
    note: "This includes the entire outdoor lawn and turf area up to the MAC, but not including Outdoor Fitness 2",
  },
  {
    facilities: "Outdoor Fitness 2 (Behind Pottery)",
    optionNames: ["Outdoor Fitness 2 (Behind Pottery)"],
    mapNumbers: [19],
  },
  {
    facilities: "Pavilion Court 1 (West) and Pavilion Court 2 (East)",
    optionNames: ["Pavilion Court 1 (West)", "Pavilion Court 2 (East)"],
    mapNumbers: [17],
    note: "Pavilion gym",
  },
  {
    facilities: "Spa, Small Pool, and Big Pool",
    optionNames: ["Spa", "Small Pool", "Big Pool"],
    mapNumbers: [13, 14, 15],
  },
  {
    facilities: "FC 1 - North Room and FC 1 - South Room",
    optionNames: ["FC 1- North Room", "FC 1 - South Room"],
    mapNumbers: [12],
    note: "Fitness Center 1",
  },
  {
    facilities: "FC 2 - 1st floor and FC 2 - Mezzanine",
    optionNames: ["FC 2 - 1st floor", "FC 2- Mezzanine"],
    mapNumbers: [23],
    note: "Fitness Center 2",
  },
  {
    facilities: "FC 3 - MAC",
    optionNames: ["FC 3 - MAC"],
    mapNumbers: [25],
    note: "Fitness Center 3",
  },
  {
    facilities: "MAC Court",
    optionNames: ["MAC Court"],
    mapNumbers: [26],
    note: "Multi-Activity Court (MAC)",
  },
  {
    facilities: "Climbing Center - MAC",
    optionNames: ["Climbing Center - MAC"],
    mapNumbers: [24],
    note: "Adventure Programs Climbing Center",
  },
];

export function isFacilityLocationHighlighted(
  entry: FacilityLocation,
  highlightedFacilities: ReadonlySet<string>,
): boolean {
  return entry.optionNames.some((name) => highlightedFacilities.has(name));
}

export function compareFacilityLocationsByMapNumber(
  a: FacilityLocation,
  b: FacilityLocation,
): number {
  const aMin = Math.min(...a.mapNumbers);
  const bMin = Math.min(...b.mapNumbers);
  if (aMin !== bMin) return aMin - bMin;
  return a.facilities.localeCompare(b.facilities);
}

export function getFacilityLocationsSortedByMapNumber(): FacilityLocation[] {
  return [...FACILITY_LOCATIONS].sort(compareFacilityLocationsByMapNumber);
}

export function getFacilityLocationsByMapNumber(mapNumber: number): FacilityLocation[] {
  return getFacilityLocationsSortedByMapNumber().filter((entry) =>
    entry.mapNumbers.includes(mapNumber),
  );
}

export function entryMatchesMapNumber(entry: FacilityLocation, mapNumber: number): boolean {
  return entry.mapNumbers.includes(mapNumber);
}
