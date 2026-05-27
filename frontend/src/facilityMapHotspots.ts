/** Click target on the facilities map image (% of image width/height). */
export type FacilityMapHotspot = {
  number: number;
  cx: number;
  cy: number;
  /** Radius as % of image width (map is ~3:2). */
  r: number;
};

/** Labels from the Recreation Center legend on the official facilities map. */
export const REC_CENTER_MAP_LABELS: Readonly<Record<number, string>> = {
  3: "Squash/Racquetball Courts",
  4: "Universal Locker Rooms & Lactation Room",
  5: "The Galleria",
  6: "Customer Service Center",
  7: "Student Employee Office",
  8: "Conference Room 2128",
  9: "Classroom 2103",
  10: "Outdoor Fitness 1",
  11: "Main Gym",
  12: "Fitness Center 1",
  13: "Spa",
  14: "Small Pool",
  15: "Large Pool",
  16: "Diving Well",
  17: "Pavilion Gym",
  18: "Adventure Rental Center",
  19: "Outdoor Fitness 2",
  20: "Pottery Studio",
  21: "Wellness & Fitness Institute",
  22: "Classroom 1501",
  23: "Fitness Center 2",
  24: "Adventure Climbing Center",
  25: "Fitness Center 3",
  26: "MAC Court",
};

/**
 * Center positions of light-blue numbered circles on `facilities-map.png`
 * (percent of full image, including the left legend).
 */
export const FACILITY_MAP_HOTSPOTS: readonly FacilityMapHotspot[] = [
  { number: 3, cx: 84, cy: 45, r: 1.8 },
  { number: 5, cx: 81, cy: 49, r: 1.8 },
  { number: 10, cx: 76, cy: 31, r: 1.8 },
  { number: 11, cx: 84, cy: 39, r: 1.8 },
  { number: 12, cx: 79, cy: 39, r: 1.8 },
  { number: 13, cx: 74, cy: 45, r: 1.8 },
  { number: 14, cx: 71, cy: 38, r: 1.8 },
  { number: 15, cx: 70, cy: 45, r: 1.8 },
  { number: 17, cx: 83, cy: 24, r: 1.8 },
  { number: 19, cx: 73, cy: 24, r: 1.8 },
  { number: 23, cx: 65, cy: 24, r: 1.8 },
  { number: 24, cx: 64, cy: 31, r: 1.8 },
  { number: 25, cx: 61, cy: 28, r: 1.8 },
  { number: 26, cx: 57, cy: 28, r: 1.8 },
];
