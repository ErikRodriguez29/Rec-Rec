export interface CalEvent {
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

// Un-fold iCal long-line continuations (RFC 5545 §3.1)
const unfold = (ics: string): string => ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");

// Extract a field value; handles optional parameters like DTSTART;TZID=...:value
const getField = (block: string, field: string): string | null => {
  const re = new RegExp(`^${field}(?:;[^:]*)?:(.+)`, "m");
  const m = block.match(re);
  return m ? m[1].replace(/\r$/, "").trim() : null;
};

// Parse iCal date strings: 20260515, 20260515T090000, 20260515T090000Z
const parseDate = (raw: string): Date | null => {
  if (!raw) return null;
  const isUTC = raw.endsWith("Z");
  const clean = raw.replace(/[^\dT]/g, "");
  if (clean.length < 8) return null;

  const tIdx = clean.indexOf("T");
  const dp = tIdx === -1 ? clean : clean.slice(0, tIdx);
  const tp = tIdx === -1 ? "" : clean.slice(tIdx + 1);

  const y = parseInt(dp.slice(0, 4));
  const mo = parseInt(dp.slice(4, 6)) - 1;
  const d = parseInt(dp.slice(6, 8));

  if (tIdx === -1) return new Date(y, mo, d); // all-day

  const h = tp.length >= 2 ? parseInt(tp.slice(0, 2)) : 0;
  const mn = tp.length >= 4 ? parseInt(tp.slice(2, 4)) : 0;
  return isUTC ? new Date(Date.UTC(y, mo, d, h, mn)) : new Date(y, mo, d, h, mn);
};

export const parseICS = (content: string): CalEvent[] => {
  const unfolded = unfold(content);
  const events: CalEvent[] = [];
  const re = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match = re.exec(unfolded);

  while (match !== null) {
    const block = match[1];
    const startStr = getField(block, "DTSTART");
    if (!startStr) {
      match = re.exec(unfolded);
      continue;
    }

    const start = parseDate(startStr);
    if (!start) {
      match = re.exec(unfolded);
      continue;
    }

    const allDay = !startStr.includes("T");
    const summary = getField(block, "SUMMARY") ?? "Event";

    const endStr = getField(block, "DTEND");
    let end: Date;
    if (endStr) {
      end = parseDate(endStr) ?? new Date(start.getTime() + 3_600_000);
    } else {
      end = allDay ? new Date(start.getTime() + 86_400_000) : new Date(start.getTime() + 3_600_000);
    }

    events.push({ summary, start, end, allDay });
    match = re.exec(unfolded);
  }

  return events;
};

const DAY_CODE: Record<number, string> = {
  0: "U",
  1: "M",
  2: "T",
  3: "W",
  4: "R",
  5: "F",
  6: "S",
};

export const eventsToSlots = (events: CalEvent[], weekMonday: Date): string[] => {
  const weekEnd = new Date(weekMonday.getTime() + 7 * 86_400_000);
  const slots = new Set<string>();

  for (const ev of events) {
    if (ev.end <= weekMonday || ev.start >= weekEnd) continue;

    const from = new Date(Math.max(ev.start.getTime(), weekMonday.getTime()));
    const to = new Date(Math.min(ev.end.getTime(), weekEnd.getTime()));

    if (ev.allDay) {
      const day = new Date(from);
      day.setHours(0, 0, 0, 0);
      while (day < to) {
        const code = DAY_CODE[day.getDay()];
        if (code) {
          for (let h = 6; h <= 22; h++) slots.add(`${code}-${h}`);
        }
        day.setDate(day.getDate() + 1);
      }
    } else {
      const cursor = new Date(from);
      cursor.setMinutes(0, 0, 0);
      while (cursor < to) {
        const code = DAY_CODE[cursor.getDay()];
        const h = cursor.getHours();
        if (code && h >= 6 && h <= 22) slots.add(`${code}-${h}`);
        cursor.setHours(cursor.getHours() + 1);
      }
    }
  }

  return [...slots];
};

export const filterEventsForWeek = (events: CalEvent[], weekMonday: Date): CalEvent[] => {
  const weekEnd = new Date(weekMonday.getTime() + 7 * 86_400_000);
  return events.filter((ev) => ev.end > weekMonday && ev.start < weekEnd);
};

export const getWeekMonday = (offsetWeeks: number): Date => {
  const today = new Date();
  const dow = today.getDay();
  const back = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + back + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const formatWeekRange = (monday: Date): string => {
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${monday.toLocaleDateString("en-US", o)} – ${sunday.toLocaleDateString("en-US", o)}`;
};

const TIME_FMT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/** Convert "7:00 AM" / "1:00 PM" strings to a 24-hour integer. */
export const parseAmPmHour = (time: string): number => {
  const [timePart, ampm] = time.split(" ");
  const h = parseInt(timePart.split(":")[0]);
  if (ampm?.toUpperCase() === "PM" && h !== 12) return h + 12;
  if (ampm?.toUpperCase() === "AM" && h === 12) return 0;
  return h;
};

export const formatEventTime = (ev: CalEvent): string => {
  if (ev.allDay) {
    const d = ev.start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return `${d} (all day)`;
  }
  const start = ev.start.toLocaleString("en-US", TIME_FMT);
  const endTime = ev.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${start} – ${endTime}`;
};
