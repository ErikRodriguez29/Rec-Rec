export type FacilityLocation = {
  facilities: string;
  /** Preferred-facilities dropdown names covered by this map entry. */
  optionNames: readonly string[];
  mapNumbers: number[];
  note?: string;
};

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
