import type { DayCode } from "../types";

const GOOGLE_CALENDAR_ACCESS_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar";

const GOOGLE_CALENDAR_TOKEN_KEY = "rec-rec-google-calendar-token";
const GOOGLE_CALENDAR_TOKEN_EXPIRES_KEY = "rec-rec-google-calendar-token-expires";
export const GOOGLE_CALENDAR_TOKEN_CHANGE_EVENT = "rec-rec-google-calendar-token-change";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

export function getGoogleCalendarAccessToken(): string | null {
  return sessionStorage.getItem(GOOGLE_CALENDAR_TOKEN_KEY);
}

export function isGoogleCalendarLinked(): boolean {
  return getGoogleCalendarAccessToken() !== null;
}

export function clearGoogleCalendarLink(): void {
  sessionStorage.removeItem(GOOGLE_CALENDAR_TOKEN_KEY);
  sessionStorage.removeItem(GOOGLE_CALENDAR_TOKEN_EXPIRES_KEY);
  window.dispatchEvent(new Event(GOOGLE_CALENDAR_TOKEN_CHANGE_EVENT));
}

function isAccessTokenValid(): boolean {
  const expiresAt = Number(sessionStorage.getItem(GOOGLE_CALENDAR_TOKEN_EXPIRES_KEY));
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt - TOKEN_EXPIRY_BUFFER_MS;
}

function persistGoogleCalendarAccessToken(accessToken: string, expiresInSeconds: number): void {
  sessionStorage.setItem(GOOGLE_CALENDAR_TOKEN_KEY, accessToken);
  sessionStorage.setItem(
    GOOGLE_CALENDAR_TOKEN_EXPIRES_KEY,
    String(Date.now() + expiresInSeconds * 1000),
  );
  window.dispatchEvent(new Event(GOOGLE_CALENDAR_TOKEN_CHANGE_EVENT));
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
            }) => void;
            error_callback?: (error: { type?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

function googleLinkErrorMessage(error?: string | { type?: string }): string {
  const code = typeof error === "string" ? error : error?.type;

  if (code === "access_denied" || code === "popup_closed_by_user" || code === "popup_closed") {
    return "Google Calendar sign-in was cancelled.";
  }

  if (code === "popup_failed_to_open") {
    return "Could not open Google sign-in. Check your popup blocker.";
  }

  if (typeof error === "string" && error) return error;

  return "Could not link Google Calendar.";
}

function dayToCode(date: Date): DayCode {
  const codes: DayCode[] = ["U", "M", "T", "W", "R", "F", "S"];
  return codes[date.getDay()];
}

function requestGoogleCalendarTokenWithScope(
  scope: string,
  options: { prompt?: string } = {},
): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return Promise.reject(new Error("Missing VITE_GOOGLE_CLIENT_ID."));
  }

  if (!window.google?.accounts?.oauth2) {
    return Promise.reject(new Error("Google Identity Services script has not loaded yet."));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      action();
    };

    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: (response) => {
        const accessToken = response.access_token;

        if (response.error || !accessToken) {
          finish(() => reject(new Error(googleLinkErrorMessage(response.error))));
          return;
        }

        persistGoogleCalendarAccessToken(accessToken, response.expires_in ?? 3600);
        finish(() => resolve(accessToken));
      },
      error_callback: (error) => {
        finish(() => reject(new Error(googleLinkErrorMessage(error))));
      },
    });

    tokenClient.requestAccessToken(options);
  });
}

async function resolveAccessToken(): Promise<string> {
  const token = getGoogleCalendarAccessToken();
  if (!token) {
    throw new Error("Link Google Calendar first.");
  }

  if (isAccessTokenValid()) {
    return token;
  }

  return requestGoogleCalendarTokenWithScope(GOOGLE_CALENDAR_ACCESS_SCOPE, { prompt: "" });
}

export async function linkGoogleCalendar(): Promise<string> {
  return requestGoogleCalendarTokenWithScope(GOOGLE_CALENDAR_ACCESS_SCOPE);
}

export function requireGoogleCalendarAccessToken(): string {
  const token = getGoogleCalendarAccessToken();

  if (!token) {
    throw new Error("Link Google Calendar first.");
  }

  return token;
}

export type GoogleCalendarExportEvent = {
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
};

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export async function insertGoogleCalendarEvents(
  accessToken: string,
  events: readonly GoogleCalendarExportEvent[],
  calendarId = "primary",
): Promise<number> {
  const token = isAccessTokenValid() ? accessToken : await resolveAccessToken();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let created = 0;

  for (const event of events) {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description,
          location: event.location,
          start: { dateTime: formatLocalDateTime(event.start), timeZone },
          end: { dateTime: formatLocalDateTime(event.end), timeZone },
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Could not add events to Google Calendar.");
    }

    created += 1;
  }

  return created;
}

export type BusyInterval = { start: string; end: string };

export type CalendarPickableEvent = {
  pickKey: string;
  calendarId: string;
  calendarLabel: string;
  googleEventId: string;
  summary: string;
  timeRangeLabel: string;
  busy: BusyInterval;
  shownAsFree: boolean;
};

export type FetchPickableEventsResult = {
  events: CalendarPickableEvent[];
  calendarWarnings: string[];
};

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
};

async function fetchCalendarListPages(
  accessToken: string,
  minAccessRole: "reader" | "writer",
): Promise<GoogleCalendarSummary[]> {
  const token = isAccessTokenValid() ? accessToken : await resolveAccessToken();
  const calendars: GoogleCalendarSummary[] = [];
  let pageToken: string | undefined;
  let done = false;

  const base = new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");
  base.searchParams.set("minAccessRole", minAccessRole);
  base.searchParams.set("maxResults", "250");

  while (!done) {
    const url = new URL(base.toString());
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
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

export async function fetchReadableCalendarList(
  accessToken: string,
): Promise<GoogleCalendarSummary[]> {
  return fetchCalendarListPages(accessToken, "reader");
}

export async function fetchWritableCalendarList(
  accessToken: string,
): Promise<GoogleCalendarSummary[]> {
  return fetchCalendarListPages(accessToken, "writer");
}

export async function createGoogleCalendar(
  accessToken: string,
  summary: string,
): Promise<GoogleCalendarSummary> {
  const token = isAccessTokenValid() ? accessToken : await resolveAccessToken();
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ summary }),
  });

  if (!response.ok) {
    throw new Error("Could not create Google Calendar.");
  }

  const data = (await response.json()) as { id?: string; summary?: string };

  if (typeof data.id !== "string") {
    throw new Error("Could not create Google Calendar.");
  }

  return {
    id: data.id,
    summary:
      typeof data.summary === "string" && data.summary.trim().length > 0
        ? data.summary.trim()
        : summary,
  };
}

async function fetchPickableEventsOneCalendar(params: {
  accessToken: string;
  calendarId: string;
  calendarLabel: string;
  timeMin: Date;
  timeMax: Date;
  responseTimeZone: string;
  includeTransparent: boolean;
}): Promise<CalendarPickableEvent[]> {
  const token = isAccessTokenValid() ? params.accessToken : await resolveAccessToken();
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
      headers: { Authorization: `Bearer ${token}` },
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

      pickable.push({
        pickKey: makePickKey(params.calendarId, raw.id),
        calendarId: params.calendarId,
        calendarLabel: params.calendarLabel,
        googleEventId: raw.id,
        summary,
        timeRangeLabel: formatEventWhen(raw, busy),
        busy,
        shownAsFree: raw.transparency === "transparent",
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

export function busyIntervalsFromPickableSelection(
  events: readonly CalendarPickableEvent[],
  selectedPickKeys: ReadonlySet<string>,
): BusyInterval[] {
  return events.filter((e) => selectedPickKeys.has(e.pickKey)).map((e) => e.busy);
}

export function busyIntervalsToWeeklyHourSlotKeys(
  busy: BusyInterval[],
  isHourOpen: (dayCode: DayCode, hour: number) => boolean,
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
      const day = dayToCode(cursor);
      const hour = cursor.getHours();
      if (isHourOpen(day, hour)) {
        out.add(`${day}-${hour}`);
      }
      cursor.setHours(cursor.getHours() + 1);
    }
  }

  return out;
}
