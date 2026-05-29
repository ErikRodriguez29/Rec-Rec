import type { OverallRec } from "../types";
import { getWeekMonday, parseAmPmHour } from "./icsParser";

const pad2 = (n: number) => n.toString().padStart(2, "0");

const toICSDateTime = (d: Date): string =>
  `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;

const DAY_INDEX: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

export const recToEventDates = (rec: OverallRec, weekMonday: Date): { start: Date; end: Date } => {
  const idx = DAY_INDEX[rec.day] ?? 0;
  const start = new Date(weekMonday);
  start.setDate(weekMonday.getDate() + idx);
  const hour = parseAmPmHour(rec.time);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + 3_600_000);
  return { start, end };
};

export const generateICS = (recs: OverallRec[], weekOffset: 0 | 1): string => {
  const monday = getWeekMonday(weekOffset);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "PRODID:-//Rec-Rec//Gym Recommender//EN",
    "METHOD:PUBLISH",
  ];

  for (const rec of recs) {
    const { start, end } = recToEventDates(rec, monday);
    lines.push(
      "BEGIN:VEVENT",
      `UID:recrec-${rec.day}-${rec.category}@recrec`,
      `DTSTART:${toICSDateTime(start)}`,
      `DTEND:${toICSDateTime(end)}`,
      `SUMMARY:${rec.facility} (${rec.category})`,
      `DESCRIPTION:Rec-Rec recommendation — Score: ${rec.score}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
};

export const downloadICS = (recs: OverallRec[], weekOffset: 0 | 1): void => {
  const content = generateICS(recs, weekOffset);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rec-rec-recommendations.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
