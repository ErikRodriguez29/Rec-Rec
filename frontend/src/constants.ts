export const ACTIVITIES = [
  "racquetball",
  "squash",
  "ellipticals (precor branded machines)",
  "stairmasters (stair machines)",
  "treadmills",
  "basketball",
  "benching",
  "bike machines",
  "weight lifting",
  "badminton",
  "arm machines",
  "core machines",
  "leg presses",
  "arm & leg machines",
  "weight crunch machines",
  "hockey",
  "skating",
  "swimming",
  "climbing",
];

export const EXERCISE_CATEGORIES = ["cardio", "arms", "core", "legs", "weight training"];

export const FACILITIES = [
  "Racquetball Court 1",
  "Racquetball Court 2",
  "Racquetball Court 3",
  "Racquetball Court 4",
  "Squash Court 1",
  "Galleria",
  "Main Gym Court 1 (North)",
  "Main Gym Court 2 (South)",
  "Outdoor Fitness 1 (Turf, Free Weights, Benches)",
  "Pavilion Court 1 (West)",
  "Pavilion Court 2 (East)",
  "Outdoor Fitness 2 (Behind Pottery)",
  "FC 1- North Room",
  "FC 1 - South Room",
  "FC 2 - 1st floor",
  "FC 2- Mezzanine",
  "FC 3 - MAC",
  "MAC Court",
  "Spa",
  "Small Pool",
  "Big Pool",
  "Pool Deck",
  "Climbing Center - MAC",
];

export const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
}));

export const DAY_CONFIGS: { code: import("./types").DayCode; name: string }[] = [
  { code: "M", name: "Monday" },
  { code: "T", name: "Tuesday" },
  { code: "W", name: "Wednesday" },
  { code: "R", name: "Thursday" },
  { code: "F", name: "Friday" },
  { code: "S", name: "Saturday" },
  { code: "U", name: "Sunday" },
];

export const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DAY_COLORS: Record<string, string> = {
  Monday: "#3b82f6",
  Tuesday: "#8b5cf6",
  Wednesday: "#06b6d4",
  Thursday: "#10b981",
  Friday: "#f59e0b",
  Saturday: "#ef4444",
  Sunday: "#ec4899",
};

export const CATEGORY_COLORS: Record<string, string> = {
  cardio: "#ef4444",
  arms: "#3b82f6",
  core: "#f59e0b",
  legs: "#10b981",
  "weight training": "#8b5cf6",
  racquetball: "#06b6d4",
  squash: "#06b6d4",
  swimming: "#3b82f6",
  climbing: "#10b981",
};
