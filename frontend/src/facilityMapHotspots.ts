export type FacilityMapHotspot = {
  number: number;
  cx: number;
  cy: number;
  r: number;
};

export const REC_CENTER_MAP_LABELS: Readonly<Record<number, string>> = {
  3: "Racquetball Courts 1–4 and Squash Court 1",
  5: "Galleria",
  10: "Outdoor Fitness 1 (Turf, Free Weights, Benches)",
  11: "Main Gym Court 1 (North) and Main Gym Court 2 (South)",
  12: "FC 1 - North Room and FC 1 - South Room",
  13: "Spa",
  14: "Small Pool",
  15: "Big Pool",
  17: "Pavilion Court 1 (West) and Pavilion Court 2 (East)",
  19: "Outdoor Fitness 2 (Behind Pottery)",
  23: "FC 2 - 1st floor and FC 2 - Mezzanine",
  24: "Climbing Center - MAC",
  25: "FC 3 - MAC",
  26: "MAC Court",
};

export const FACILITY_MAP_HOTSPOTS: readonly FacilityMapHotspot[] = [
  { number: 3, cx: 71.9, cy: 78.9, r: 3.2 },
  { number: 5, cx: 66.7, cy: 86.0, r: 3.2 },
  { number: 10, cx: 57.9, cy: 54.4, r: 3.2 },
  { number: 11, cx: 71.9, cy: 68.4, r: 3.2 },
  { number: 12, cx: 63.2, cy: 68.4, r: 3.2 },
  { number: 13, cx: 54.4, cy: 78.9, r: 3.2 },
  { number: 14, cx: 49.1, cy: 66.7, r: 3.2 },
  { number: 15, cx: 47.4, cy: 78.9, r: 3.2 },
  { number: 17, cx: 70.2, cy: 42.1, r: 3.2 },
  { number: 19, cx: 52.6, cy: 42.1, r: 3.2 },
  { number: 23, cx: 38.6, cy: 42.1, r: 3.2 },
  { number: 24, cx: 36.8, cy: 54.4, r: 3.2 },
  { number: 25, cx: 31.6, cy: 49.1, r: 3.2 },
  { number: 26, cx: 24.6, cy: 49.1, r: 3.2 },
];
