import { useCallback, useEffect, useState } from "react";
import {
  clearGoogleCalendarLink,
  getGoogleCalendarAccessToken,
  GOOGLE_CALENDAR_TOKEN_CHANGE_EVENT,
  isGoogleCalendarLinked,
  linkGoogleCalendar,
} from "./api/googleCalendar";

export function useGoogleCalendarLink() {
  const [linked, setLinked] = useState(() => isGoogleCalendarLinked());
  const [accessToken, setAccessToken] = useState(() => getGoogleCalendarAccessToken());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setLinked(isGoogleCalendarLinked());
      setAccessToken(getGoogleCalendarAccessToken());
    };

    window.addEventListener(GOOGLE_CALENDAR_TOKEN_CHANGE_EVENT, sync);

    return () => {
      window.removeEventListener(GOOGLE_CALENDAR_TOKEN_CHANGE_EVENT, sync);
    };
  }, []);

  const link = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await linkGoogleCalendar();
      setAccessToken(token);
      setLinked(true);
      return token;
    } catch (linkError) {
      const message =
        linkError instanceof Error ? linkError.message : "Could not link Google Calendar.";
      setError(message);
      throw linkError;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    clearGoogleCalendarLink();
    setAccessToken(null);
    setLinked(false);
    setError(null);
  }, []);

  return { linked, accessToken, loading, error, link, disconnect, setError };
}
