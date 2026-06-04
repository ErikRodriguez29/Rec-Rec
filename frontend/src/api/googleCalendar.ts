import type { DayCode } from "../types";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

interface GoogleBusyRange {
  start: string;
  end: string;
}

interface GoogleFreeBusyResponse {
  calendars?: Record<
    string,
    {
      busy?: GoogleBusyRange[];
    }
  >;
}

export interface GoogleBusySlot {
  day: DayCode;
  hour: number;
}

function getWeekRange() {
  const now = new Date();
  const start = new Date(now);

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

function dayToCode(date: Date): DayCode {
  const codes: DayCode[] = ["U", "M", "T", "W", "R", "F", "S"];
  return codes[date.getDay()];
}

function busyRangesToSlots(ranges: GoogleBusyRange[]): GoogleBusySlot[] {
  const slots: GoogleBusySlot[] = [];

  for (const range of ranges) {
    const start = new Date(range.start);
    const end = new Date(range.end);

    const cursor = new Date(start);
    cursor.setMinutes(0, 0, 0);

    while (cursor < end) {
      const day = dayToCode(cursor);
      const hour = cursor.getHours();

      slots.push({ day, hour });
      cursor.setHours(cursor.getHours() + 1);
    }
  }

  return slots;
}

export function requestGoogleCalendarToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return Promise.reject(new Error("Missing VITE_GOOGLE_CLIENT_ID."));
  }

  if (!window.google?.accounts?.oauth2) {
    return Promise.reject(new Error("Google Identity Services script has not loaded yet."));
  }

  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || "Could not link Google Calendar."));
          return;
        }

        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken();
  });
}

export async function fetchGoogleBusySlots(accessToken: string): Promise<GoogleBusySlot[]> {
  const { timeMin, timeMax } = getWeekRange();

  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  });

  if (!response.ok) {
    throw new Error("Could not read Google Calendar busy times.");
  }

  const data = (await response.json()) as GoogleFreeBusyResponse;
  const ranges = data.calendars?.primary?.busy ?? [];

  return busyRangesToSlots(ranges);
}
