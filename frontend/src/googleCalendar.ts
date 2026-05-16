/** `Date.getDay()` 0 = Sun … 6 = Sat → survey day codes (`u` Sunday … `s` Saturday). */
const JS_DAY_TO_SURVEY_CODE: Record<number, string> = {
  0: "u",
  1: "m",
  2: "t",
  3: "w",
  4: "r",
  5: "f",
  6: "s",
};

export type BusyInterval = { start: string; end: string };

/** One row in the event-picker UI (unique across all loaded calendars). */
export type CalendarPickableEvent = {
  /** Unique key: calendar id + Google event id */
  pickKey: string;
  calendarId: string;
  calendarLabel: string;
  googleEventId: string;
  summary: string;
  timeRangeLabel: string;
  busy: BusyInterval;
  /** Event was marked "free" / transparent in Google; still listed when user opts in */
  shownAsFree: boolean;
};

export type FetchPickableEventsResult = {
  events: CalendarPickableEvent[];
  /** Calendars we could not read (403, etc.) */
  calendarWarnings: string[];
};

/** Entry from `calendarList` (readable calendars on the signed-in account). */
export type GoogleCalendarSummary = { id: string; summary: string };

type GcalEventLike = {
  id?: string;
  summary?: string;
  status?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function makePickKey(calendarId: string, eventId: string) {
  return `${encodeURIComponent(calendarId)}::${eventId}`;
}

function gcalEventToBusyInterval(
  ev: GcalEventLike,
  opts: { includeTransparent: boolean },
): BusyInterval | null {
  if (ev.status === "cancelled") return null;
  if (!opts.includeTransparent && ev.transparency === "transparent") return null;

  const startDt = ev.start?.dateTime;
  const endDt = ev.end?.dateTime;
  const startDate = ev.start?.date;
  const endDate = ev.end?.date;

  if (startDt && endDt) return { start: startDt, end: endDt };
  if (startDate && endDate) {
    return {
      start: `${startDate}T00:00:00`,
      end: `${endDate}T00:00:00`,
    };
  }
  return null;
}

function formatEventWhen(ev: GcalEventLike, busy: BusyInterval): string {
  const start = new Date(busy.start);
  const end = new Date(busy.end);
  const timed = Boolean(ev.start?.dateTime && ev.end?.dateTime);

  if (!timed) {
    const lastMoment = new Date(end.getTime() - 1);
    const sameCalendarDay =
      start.getFullYear() === lastMoment.getFullYear() &&
      start.getMonth() === lastMoment.getMonth() &&
      start.getDate() === lastMoment.getDate();
    const df = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    if (sameCalendarDay) return `All day · ${df.format(start)}`;
    return `All day · ${df.format(start)} – ${df.format(lastMoment)}`;
  }

  const df = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${df.format(start)} – ${df.format(end)}`;
}

type CalendarListEntry = {
  id?: string;
  summary?: string;
  hidden?: boolean;
};

async function fetchReadableCalendarListPages(
  accessToken: string,
): Promise<GoogleCalendarSummary[]> {
  const calendars: GoogleCalendarSummary[] = [];
  let pageToken: string | undefined;
  let done = false;

  const base = new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");
  base.searchParams.set("minAccessRole", "reader");
  base.searchParams.set("maxResults", "250");

  while (!done) {
    const url = new URL(base.toString());
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Calendar list API ${res.status}: ${text}`);
    }

    const data: unknown = await res.json();
    const items =
      typeof data === "object" &&
      data !== null &&
      "items" in data &&
      Array.isArray((data as { items: unknown }).items)
        ? ((data as { items: CalendarListEntry[] }).items ?? [])
        : [];

    for (const entry of items) {
      if (typeof entry.id !== "string") continue;
      const summary =
        typeof entry.summary === "string" && entry.summary.trim().length > 0
          ? entry.summary.trim()
          : entry.id;
      calendars.push({ id: entry.id, summary });
    }

    const next =
      typeof data === "object" &&
      data !== null &&
      "nextPageToken" in data &&
      typeof (data as { nextPageToken?: unknown }).nextPageToken === "string"
        ? (data as { nextPageToken: string }).nextPageToken
        : undefined;

    if (!next) done = true;
    else pageToken = next;
  }

  return calendars;
}

/** All calendars your token can read (for UI multi-select). */
export async function fetchReadableCalendarList(
  accessToken: string,
): Promise<GoogleCalendarSummary[]> {
  return fetchReadableCalendarListPages(accessToken);
}

async function fetchPickableEventsOneCalendar(params: {
  accessToken: string;
  calendarId: string;
  calendarLabel: string;
  timeMin: Date;
  timeMax: Date;
  /** Passed through to events.list so recurring instances match the user's zone */
  responseTimeZone: string;
  includeTransparent: boolean;
}): Promise<CalendarPickableEvent[]> {
  const base = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events`,
  );
  base.searchParams.set("singleEvents", "true");
  base.searchParams.set("orderBy", "startTime");
  base.searchParams.set("timeMin", params.timeMin.toISOString());
  base.searchParams.set("timeMax", params.timeMax.toISOString());
  base.searchParams.set("maxResults", "250");
  base.searchParams.set("timeZone", params.responseTimeZone);

  const pickable: CalendarPickableEvent[] = [];
  let pageToken: string | undefined;
  let done = false;

  while (!done) {
    const url = new URL(base.toString());
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    const data: unknown = await res.json();
    const items =
      typeof data === "object" &&
      data !== null &&
      "items" in data &&
      Array.isArray((data as { items: unknown }).items)
        ? ((data as { items: GcalEventLike[] }).items ?? [])
        : [];

    for (const raw of items) {
      if (typeof raw.id !== "string") continue;
      const busy = gcalEventToBusyInterval(raw, {
        includeTransparent: params.includeTransparent,
      });
      if (!busy) continue;

      const summary =
        typeof raw.summary === "string" && raw.summary.trim().length > 0
          ? raw.summary.trim()
          : "(No title)";

      const shownAsFree = raw.transparency === "transparent";

      pickable.push({
        pickKey: makePickKey(params.calendarId, raw.id),
        calendarId: params.calendarId,
        calendarLabel: params.calendarLabel,
        googleEventId: raw.id,
        summary,
        timeRangeLabel: formatEventWhen(raw, busy),
        busy,
        shownAsFree,
      });
    }

    const next =
      typeof data === "object" &&
      data !== null &&
      "nextPageToken" in data &&
      typeof (data as { nextPageToken?: unknown }).nextPageToken === "string"
        ? (data as { nextPageToken: string }).nextPageToken
        : undefined;

    if (!next) done = true;
    else pageToken = next;
  }

  return pickable;
}

/**
 * Loads expanded event instances from the calendars you pass in (typically a user-selected subset).
 */
export async function fetchPickableCalendarEvents(params: {
  accessToken: string;
  timeMin: Date;
  timeMax: Date;
  includeTransparent: boolean;
  calendars: readonly GoogleCalendarSummary[];
}): Promise<FetchPickableEventsResult> {
  const responseTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const calendarWarnings: string[] = [];
  const merged: CalendarPickableEvent[] = [];

  if (params.calendars.length === 0) {
    return { events: merged, calendarWarnings };
  }

  await Promise.all(
    params.calendars.map(async (cal) => {
      try {
        const rows = await fetchPickableEventsOneCalendar({
          accessToken: params.accessToken,
          calendarId: cal.id,
          calendarLabel: cal.summary,
          timeMin: params.timeMin,
          timeMax: params.timeMax,
          responseTimeZone,
          includeTransparent: params.includeTransparent,
        });
        merged.push(...rows);
      } catch {
        calendarWarnings.push(cal.summary);
      }
    }),
  );

  merged.sort((a, b) => new Date(a.busy.start).getTime() - new Date(b.busy.start).getTime());

  return { events: merged, calendarWarnings };
}

/** Build unavailable grid keys from whichever intervals the user chose. */
export function busyIntervalsFromPickableSelection(
  events: readonly CalendarPickableEvent[],
  selectedPickKeys: ReadonlySet<string>,
): BusyInterval[] {
  return events.filter((e) => selectedPickKeys.has(e.pickKey)).map((e) => e.busy);
}

/**
 * Maps ISO busy intervals to recurring weekly slot keys `m-14`, etc.
 * Each covered clock hour (local) touching the interval adds one key.
 */
export function busyIntervalsToWeeklyHourSlotKeys(
  busy: BusyInterval[],
  isHourOpen: (dayCode: string, hour: number) => boolean,
): Set<string> {
  const out = new Set<string>();
  for (const b of busy) {
    const start = new Date(b.start);
    const end = new Date(b.end);
    if (!(start < end)) continue;

    const cursor = new Date(start);
    cursor.setMinutes(0, 0, 0);
    cursor.setMilliseconds(0);

    while (cursor < end) {
      const code = JS_DAY_TO_SURVEY_CODE[cursor.getDay()];
      if (code) {
        const hour = cursor.getHours();
        if (isHourOpen(code, hour)) {
          out.add(`${code}-${hour}`);
        }
      }
      cursor.setHours(cursor.getHours() + 1);
    }
  }
  return out;
}
