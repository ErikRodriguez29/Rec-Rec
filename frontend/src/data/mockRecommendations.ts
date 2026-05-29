import type { RecommendationResult } from "../types";

const weekData = {
  categories: [
    {
      category: "cardio",
      days: [
        {
          day: "Monday",
          facilities: [
            { facility: "Pavilion Court 1 (West)", times: ["7:00 AM"], score: 58.0 },
            { facility: "Racquetball Court 1", times: ["6:00 AM"], score: 58.0 },
          ],
        },
        {
          day: "Tuesday",
          facilities: [
            { facility: "Racquetball Court 1", times: ["6:00 AM"], score: 58.0 },
            { facility: "Racquetball Court 4", times: ["8:00 AM"], score: 58.0 },
          ],
        },
        {
          day: "Wednesday",
          facilities: [
            { facility: "Pavilion Court 1 (West)", times: ["7:00 AM"], score: 58.0 },
            { facility: "Racquetball Court 1", times: ["6:00 AM"], score: 58.0 },
          ],
        },
        {
          day: "Thursday",
          facilities: [
            { facility: "Racquetball Court 1", times: ["6:00 AM"], score: 58.0 },
            { facility: "Squash Court 1", times: ["7:00 AM"], score: 58.0 },
          ],
        },
        {
          day: "Friday",
          facilities: [
            { facility: "Racquetball Court 1", times: ["6:00 AM"], score: 58.0 },
            { facility: "Racquetball Court 4", times: ["9:00 AM"], score: 58.0 },
          ],
        },
        {
          day: "Saturday",
          facilities: [
            { facility: "Racquetball Court 1", times: ["1:00 PM"], score: 38.0 },
            { facility: "Squash Court 1", times: ["5:00 PM"], score: 38.0 },
          ],
        },
        {
          day: "Sunday",
          facilities: [
            { facility: "Racquetball Court 1", times: ["9:00 AM"], score: 58.0 },
            { facility: "Racquetball Court 3", times: ["9:00 AM"], score: 58.0 },
          ],
        },
      ],
    },
    {
      category: "squash",
      days: [
        {
          day: "Monday",
          facilities: [{ facility: "Squash Court 1", times: ["6:00 AM", "8:00 AM"], score: 58.0 }],
        },
        {
          day: "Tuesday",
          facilities: [{ facility: "Squash Court 1", times: ["6:00 AM", "7:00 AM"], score: 58.0 }],
        },
        {
          day: "Wednesday",
          facilities: [{ facility: "Squash Court 1", times: ["6:00 AM", "8:00 AM"], score: 58.0 }],
        },
        {
          day: "Thursday",
          facilities: [{ facility: "Squash Court 1", times: ["6:00 AM", "8:00 AM"], score: 58.0 }],
        },
        {
          day: "Friday",
          facilities: [{ facility: "Squash Court 1", times: ["6:00 AM", "7:00 AM"], score: 58.0 }],
        },
        {
          day: "Saturday",
          facilities: [{ facility: "Squash Court 1", times: ["1:00 PM", "2:00 PM"], score: 38.0 }],
        },
        {
          day: "Sunday",
          facilities: [
            { facility: "Squash Court 1", times: ["9:00 AM", "11:00 AM"], score: 56.35 },
          ],
        },
      ],
    },
  ],
  overall: [
    {
      day: "Monday",
      facility: "Pavilion Court 1 (West)",
      time: "7:00 AM",
      category: "cardio",
      score: 58.0,
    },
    {
      day: "Tuesday",
      facility: "Squash Court 1",
      time: "6:00 AM",
      category: "squash",
      score: 58.0,
    },
    {
      day: "Wednesday",
      facility: "Squash Court 1",
      time: "6:00 AM",
      category: "squash",
      score: 58.0,
    },
    {
      day: "Wednesday",
      facility: "Racquetball Court 1",
      time: "6:00 AM",
      category: "cardio",
      score: 58.0,
    },
    {
      day: "Thursday",
      facility: "Squash Court 1",
      time: "6:00 AM",
      category: "squash",
      score: 58.0,
    },
    {
      day: "Friday",
      facility: "Racquetball Court 1",
      time: "6:00 AM",
      category: "cardio",
      score: 58.0,
    },
    {
      day: "Saturday",
      facility: "Squash Court 1",
      time: "1:00 PM",
      category: "squash",
      score: 38.0,
    },
    {
      day: "Sunday",
      facility: "Racquetball Court 1",
      time: "9:00 AM",
      category: "cardio",
      score: 58.0,
    },
  ],
};

export const mockRecommendations: RecommendationResult = {
  currentWeek: weekData,
  nextWeek: weekData,
};
