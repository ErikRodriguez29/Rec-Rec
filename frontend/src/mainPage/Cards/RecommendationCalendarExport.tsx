import { useMemo } from "react";
import { Calendar, dateFnsLocalizer, type Event as CalendarEvent } from "react-big-calendar";
import { createEvents, type EventAttributes } from "ics";
import { addDays, format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import type { WeekRecs } from "../../types";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./RecommendationCalendarExport.css";

type WeekKey = "current" | "next";

const CalendarEventCard = ({ event }: { event: RecommendationCalendarEvent }) => {
  return (
    <div
      className="calendar-event-card"
      title={`${event.resource.activity} at ${event.resource.facility}`}
    >
      <span className="calendar-event-title">{event.resource.activity}</span>
      <span className="calendar-event-facility">{event.resource.facility}</span>
    </div>
  );
};

interface RecommendationCalendarExportProps {
  recs: WeekRecs;
  week: WeekKey;
  name: string;
}

interface RecommendationCalendarEvent extends CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  allDay: false;
  resource: {
    activity: string;
    facility: string;
    day: string;
    time: string;
  };
}

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const dayOffsetByValue: Record<string, number> = {
  U: 0,
  SUNDAY: 0,
  SUN: 0,

  M: 1,
  MONDAY: 1,
  MON: 1,

  T: 2,
  TUESDAY: 2,
  TUE: 2,

  W: 3,
  WEDNESDAY: 3,
  WED: 3,

  R: 4,
  THURSDAY: 4,
  THU: 4,

  F: 5,
  FRIDAY: 5,
  FRI: 5,

  SATURDAY: 6,
  SAT: 6,
};

const getDayOffset = (day: string) => {
  return dayOffsetByValue[day.trim().toUpperCase()] ?? null;
};

const getRecString = (rec: unknown, keys: string[]) => {
  if (!rec || typeof rec !== "object") return "";

  const obj = rec as Record<string, unknown>;

  for (const key of keys) {
    const value = obj[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

const normalizeTime = (time: string) => {
  const cleaned = time.trim().toLowerCase();

  if (cleaned.includes("morning")) return { hour: 9, minute: 0 };
  if (cleaned.includes("afternoon")) return { hour: 14, minute: 0 };
  if (cleaned.includes("evening")) return { hour: 18, minute: 0 };
  if (cleaned.includes("night")) return { hour: 20, minute: 0 };

  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);

  if (!match) {
    return { hour: 12, minute: 0 };
  }

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridian = match[3];

  if (meridian === "pm" && hour !== 12) hour += 12;
  if (meridian === "am" && hour === 12) hour = 0;

  return { hour, minute };
};

const getWeekBaseDate = (week: WeekKey) => {
  const currentSunday = startOfWeek(new Date(), { weekStartsOn: 0 });
  currentSunday.setHours(0, 0, 0, 0);

  return week === "current" ? currentSunday : addDays(currentSunday, 7);
};

const dateToIcsTuple = (date: Date): [number, number, number, number, number] => [
  date.getFullYear(),
  date.getMonth() + 1,
  date.getDate(),
  date.getHours(),
  date.getMinutes(),
];

const buildCalendarEvents = (recs: WeekRecs, week: WeekKey): RecommendationCalendarEvent[] => {
  const baseDate = getWeekBaseDate(week);

  return recs.overall
    .map((rec) => {
      const day = getRecString(rec, ["day"]);
      const activity = getRecString(rec, [
        "activity",
        "category",
        "activityOrCategory",
        "activity_or_category",
      ]);
      const facility = getRecString(rec, ["facility", "facilityName", "facility_name"]);
      const time = getRecString(rec, ["bestTime", "best_time", "time", "timeOfDay", "time_of_day"]);

      const dayOffset = getDayOffset(day);

      if (dayOffset === null || !time) {
        return null;
      }

      const { hour, minute } = normalizeTime(time);

      const start = addDays(baseDate, dayOffset);
      start.setHours(hour, minute, 0, 0);

      const end = new Date(start);
      end.setHours(start.getHours() + 1);

      return {
        title: `${activity || "Activity"} — ${facility || "Facility"}`,
        start,
        end,
        allDay: false,
        resource: {
          activity: activity || "Activity",
          facility: facility || "Facility",
          day,
          time,
        },
      };
    })
    .filter((event): event is RecommendationCalendarEvent => event !== null);
};

const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], {
    type: "text/calendar;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
};

const RecommendationCalendarExport = ({ recs, week, name }: RecommendationCalendarExportProps) => {
  const calendarDate = useMemo(() => getWeekBaseDate(week), [week]);

  const events = useMemo(() => {
    const builtEvents = buildCalendarEvents(recs, week);
    console.log("Calendar input recs:", recs.overall);
    console.log("Calendar built events:", builtEvents);
    return builtEvents;
  }, [recs, week]);

  const handleDownloadIcs = () => {
    const icsEvents: EventAttributes[] = events.map((event) => ({
      title: event.title,
      description: `${event.resource.activity} at ${event.resource.facility}`,
      location: event.resource.facility,
      start: dateToIcsTuple(event.start),
      end: dateToIcsTuple(event.end),
      startInputType: "local",
      endInputType: "local",
    }));

    const { error, value } = createEvents(icsEvents);

    if (error || !value) {
      return;
    }

    const safeName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    downloadTextFile(`${safeName || "recommendations"}-${week}.ics`, value);
  };

  return (
    <section className="recommendation-calendar-export">
      <div className="recommendation-calendar-header">
        <div>
          <p className="recommendation-calendar-eyebrow">
            {week === "current" ? "Current week" : "Next week"}
          </p>
          <h3>Calendar Preview</h3>
          <p className="recommendation-calendar-copy">
            Preview this schedule or download it as an .ics calendar file.
          </p>
        </div>

        <button
          type="button"
          className="ics-download-button"
          onClick={handleDownloadIcs}
          disabled={events.length === 0}
        >
          Download .ics
        </button>
      </div>

      {events.length === 0 ? (
        <div className="recommendation-calendar-empty">
          <h4>No calendar events found</h4>
          <p>The planner did not return readable day/time recommendations.</p>
        </div>
      ) : (
        <div className="recommendation-calendar-shell">
          <Calendar
            key={week}
            localizer={localizer}
            events={events}
            defaultDate={calendarDate}
            defaultView="week"
            views={["week", "day", "agenda"]}
            startAccessor="start"
            endAccessor="end"
            titleAccessor="title"
            toolbar
            popup
            components={{
              event: CalendarEventCard,
            }}
            style={{ height: 520 }}
          />
        </div>
      )}
    </section>
  );
};

export default RecommendationCalendarExport;
