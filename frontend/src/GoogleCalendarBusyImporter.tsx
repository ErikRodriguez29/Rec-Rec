import { hasGrantedAllScopesGoogle, useGoogleLogin, useGoogleOAuth } from "@react-oauth/google";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  type AlertColor,
  type SelectChangeEvent,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  busyIntervalsFromPickableSelection,
  busyIntervalsToWeeklyHourSlotKeys,
  fetchPickableCalendarEvents,
  fetchReadableCalendarList,
  type CalendarPickableEvent,
  type GoogleCalendarSummary,
} from "./googleCalendar";

type Props = {
  isHourOpen: (dayCode: string, hour: number) => boolean;
  onMergeBusySlots: (keys: ReadonlySet<string>) => void;
};

const RANGE_DAYS_OPTIONS = [7, 14, 21, 30] as const;

/** Required for Calendar API read access. */
const CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const CALENDAR_403_HINT =
  "Calendar returned 403 — this token may lack Calendar scope. Disconnect, then sign in again and approve Calendar access. Confirm your OAuth consent screen includes the Calendar readonly scope and Calendar API is enabled.";

export default function GoogleCalendarBusyImporter(props: Props) {
  const { isHourOpen, onMergeBusySlots } = props;
  const { scriptLoadedSuccessfully } = useGoogleOAuth();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [directoryCalendars, setDirectoryCalendars] = useState<GoogleCalendarSummary[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<GoogleCalendarSummary[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [includeTransparent, setIncludeTransparent] = useState(false);
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_DAYS_OPTIONS)[number]>(14);
  const [loadedEvents, setLoadedEvents] = useState<CalendarPickableEvent[]>([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importBanner, setImportBanner] = useState<{
    severity: AlertColor;
    message: string;
  } | null>(null);

  const resetLoadedCalendar = useCallback(() => {
    setLoadedEvents([]);
    setSelectedIds(new Set());
    setImportBanner(null);
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setDirectoryCalendars([]);
      setSelectedCalendars([]);
      setLoadingDirectory(false);
      return;
    }

    let cancelled = false;
    setLoadingDirectory(true);
    setError(null);
    setDirectoryCalendars([]);
    setSelectedCalendars([]);

    void fetchReadableCalendarList(accessToken)
      .then((list) => {
        if (cancelled) return;
        setDirectoryCalendars(list);
        setSelectedCalendars([]);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load your calendar list. Try disconnecting and signing in again.");
        setDirectoryCalendars([]);
        setSelectedCalendars([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDirectory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const calendarsSelectionKey = useMemo(
    () =>
      [...selectedCalendars]
        .map((c) => c.id)
        .sort()
        .join("\0"),
    [selectedCalendars],
  );

  useEffect(() => {
    resetLoadedCalendar();
  }, [calendarsSelectionKey, resetLoadedCalendar]);

  const login = useGoogleLogin({
    flow: "implicit",
    /**
     * Without this, the library sends `openid profile email ${scope}`, which
     * often yields tokens that cannot call Calendar (403 insufficient scopes).
     */
    overrideScope: true,
    scope: CALENDAR_READONLY_SCOPE,
    prompt: "consent",
    include_granted_scopes: true,
    onSuccess: (tokenResponse) => {
      const scopeField = tokenResponse.scope ?? "";
      const grantedViaHelper = hasGrantedAllScopesGoogle(tokenResponse, CALENDAR_READONLY_SCOPE);
      const grantedViaString =
        scopeField.includes("calendar.readonly") || scopeField.includes("/auth/calendar");

      if (scopeField.length > 0 && !grantedViaString && !grantedViaHelper) {
        setError(
          "Google did not attach Calendar permission to this token. In Google Cloud, open APIs & Services > OAuth consent screen > Scopes, add Google Calendar API scope calendar.readonly, save, disconnect here, then sign in again.",
        );
        return;
      }
      setAccessToken(tokenResponse.access_token);
      setError(null);
      resetLoadedCalendar();
    },
    onError: () => {
      setError("Google authorization failed or was denied.");
    },
  });

  const handleLoadEvents = useCallback(async () => {
    if (!accessToken) return;
    setLoadingList(true);
    setError(null);
    setImportBanner(null);
    try {
      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date(timeMin);
      timeMax.setDate(timeMax.getDate() + rangeDays);

      if (selectedCalendars.length === 0) {
        setError("Choose at least one calendar to load events from.");
        setLoadingList(false);
        return;
      }

      const { events: evs, calendarWarnings } = await fetchPickableCalendarEvents({
        accessToken,
        timeMin,
        timeMax,
        includeTransparent,
        calendars: selectedCalendars,
      });
      setLoadedEvents(evs);
      setSelectedIds(new Set());

      if (calendarWarnings.length > 0) {
        setImportBanner({
          severity: "warning",
          message:
            `Could not read ${calendarWarnings.length} calendar(s): ${calendarWarnings.join("; ")}. They may need to be shared with your Google account or re-added.` +
            (evs.length === 0 ? " No events were loaded." : ""),
        });
      } else if (evs.length === 0) {
        setImportBanner({
          severity: "info",
          message:
            'No events matched in this date range for the calendars you selected (cancelled entries are skipped). Add calendars above or turn on "Include events shown as Free" if classes display as free.',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (
        msg.includes("403") &&
        (msg.includes("scope") || msg.includes("PERMISSION_DENIED") || msg.includes("Insufficient"))
      ) {
        setError(CALENDAR_403_HINT);
      } else {
        setError(e instanceof Error ? e.message : "Could not read Google Calendar.");
      }
    } finally {
      setLoadingList(false);
    }
  }, [accessToken, rangeDays, includeTransparent, selectedCalendars]);

  const toggleEventId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImportSelected = () => {
    const intervals = busyIntervalsFromPickableSelection(loadedEvents, selectedIds);
    const keys = busyIntervalsToWeeklyHourSlotKeys(intervals, isHourOpen);
    onMergeBusySlots(keys);

    if (keys.size === 0) {
      setImportBanner({
        severity: "warning",
        message:
          "None of the selected events overlap facility hours on the weekly grid. Pick different events or paint unavailable hours manually.",
      });
    } else {
      setImportBanner({
        severity: "success",
        message: `Marked ${keys.size} hourly slots unavailable from ${selectedIds.size} selected event(s) (facility hours only).`,
      });
    }
  };

  const handleRangeChange = (e: SelectChangeEvent<number>) => {
    setRangeDays(Number(e.target.value) as (typeof RANGE_DAYS_OPTIONS)[number]);
    resetLoadedCalendar();
  };

  const selectAllLoaded = () => {
    setSelectedIds(new Set(loadedEvents.map((ev) => ev.pickKey)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectAllCalendars = () => {
    setSelectedCalendars(directoryCalendars);
  };

  const clearCalendarsSelection = () => {
    setSelectedCalendars([]);
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        Google Calendar — pick events as busy
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Choose which{" "}
        <Box component="span" sx={{ fontWeight: 600 }}>
          calendars
        </Box>{" "}
        to scan, load events, then check specific occurrences to block workouts as{" "}
        <Box component="span" sx={{ fontWeight: 600 }}>
          unavailable (red)
        </Box>
        . Events Google marks as &quot;free&quot; stay hidden unless you enable the checkbox below.
      </Typography>

      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        {!accessToken ? (
          <Button
            variant="outlined"
            onClick={() => login({ prompt: "consent" })}
            disabled={!scriptLoadedSuccessfully || loadingList}
          >
            Sign in with Google
          </Button>
        ) : (
          <>
            <Typography variant="body2" color="success.main">
              Calendar connected
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setAccessToken(null);
                resetLoadedCalendar();
                login({ prompt: "consent" });
              }}
              disabled={!scriptLoadedSuccessfully || loadingList}
            >
              Re-authorize
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                setAccessToken(null);
                resetLoadedCalendar();
                setDirectoryCalendars([]);
                setSelectedCalendars([]);
                setError(null);
              }}
            >
              Disconnect
            </Button>
          </>
        )}
      </Stack>

      {accessToken !== null && (
        <Stack spacing={0.75}>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            <Autocomplete
              multiple
              fullWidth
              sx={{ flex: "1 1 280px", minWidth: 240 }}
              options={directoryCalendars}
              value={selectedCalendars}
              loading={loadingDirectory}
              disabled={loadingDirectory || directoryCalendars.length === 0}
              onChange={(_, newValue) => setSelectedCalendars(newValue)}
              getOptionLabel={(o) => o.summary}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              disableCloseOnSelect
              limitTags={4}
              renderValue={(value, getItemProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getItemProps({ index })}
                    key={option.id}
                    label={option.summary}
                    size="small"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Calendars to load events from"
                  placeholder={loadingDirectory ? "Loading calendar list…" : "Pick one or more"}
                />
              )}
            />
            <Button size="small" variant="text" onClick={selectAllCalendars}>
              All calendars
            </Button>
            <Button size="small" variant="text" onClick={clearCalendarsSelection}>
              Clear calendars
            </Button>
          </Stack>
        </Stack>
      )}

      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="gcal-range-label">Date range</InputLabel>
          <Select<number>
            labelId="gcal-range-label"
            label="Date range"
            value={rangeDays}
            onChange={handleRangeChange}
          >
            {RANGE_DAYS_OPTIONS.map((d) => (
              <MenuItem key={d} value={d}>
                Next {d} days
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          color="secondary"
          onClick={() => void handleLoadEvents()}
          disabled={
            !accessToken ||
            loadingList ||
            !scriptLoadedSuccessfully ||
            selectedCalendars.length === 0 ||
            loadingDirectory
          }
        >
          {loadingList ? <CircularProgress size={22} color="inherit" /> : "Load calendar events"}
        </Button>

        <FormControlLabel
          sx={{ ml: 0 }}
          control={
            <Checkbox
              checked={includeTransparent}
              onChange={(e) => {
                setIncludeTransparent(e.target.checked);
                resetLoadedCalendar();
              }}
              size="small"
            />
          }
          label={
            <Typography variant="body2">
              Include events shown as Free in Google (transparent)
            </Typography>
          }
        />

        <Button
          variant="contained"
          color="secondary"
          onClick={handleImportSelected}
          disabled={
            !accessToken ||
            loadedEvents.length === 0 ||
            selectedIds.size === 0 ||
            loadingList ||
            !scriptLoadedSuccessfully
          }
        >
          Import selected as unavailable
        </Button>
      </Stack>

      {loadedEvents.length > 0 && (
        <Stack spacing={1}>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedIds.size} of {loadedEvents.length} selected
            </Typography>
            <Button size="small" variant="text" onClick={selectAllLoaded}>
              Select all
            </Button>
            <Button size="small" variant="text" onClick={clearSelection}>
              Clear selection
            </Button>
          </Stack>
          <Paper
            variant="outlined"
            sx={{
              maxHeight: 320,
              overflow: "auto",
              bgcolor: "background.paper",
            }}
          >
            <List dense disablePadding>
              {loadedEvents.map((ev) => (
                <ListItem key={ev.pickKey} disablePadding>
                  <ListItemButton
                    dense
                    onClick={() => toggleEventId(ev.pickKey)}
                    selected={selectedIds.has(ev.pickKey)}
                  >
                    <ListItemIcon sx={{ minWidth: 42 }}>
                      <Checkbox
                        edge="start"
                        checked={selectedIds.has(ev.pickKey)}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {ev.summary}
                        </Typography>
                      }
                      secondary={
                        <Box component="span" sx={{ display: "block" }}>
                          <Typography
                            variant="caption"
                            component="span"
                            sx={{ display: "block", color: "text.secondary" }}
                          >
                            {ev.calendarLabel}
                          </Typography>
                          <Typography
                            variant="caption"
                            component="span"
                            sx={{
                              display: "block",
                              color: ev.shownAsFree ? "warning.main" : "text.secondary",
                            }}
                          >
                            {ev.timeRangeLabel}
                            {ev.shownAsFree ? " · marked Free in Google" : ""}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Stack>
      )}

      {!scriptLoadedSuccessfully && (
        <Typography variant="caption" color="text.secondary">
          Loading Google sign-in…
        </Typography>
      )}

      {error !== null && <Alert severity="error">{error}</Alert>}
      {importBanner !== null && (
        <Alert severity={importBanner.severity}>{importBanner.message}</Alert>
      )}
    </Stack>
  );
}
