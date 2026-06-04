import {
  Autocomplete,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
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
} from "../../api/googleCalendar";
import type { DayCode } from "../../types";

const RANGE_DAYS_OPTIONS = [7, 14, 21, 30] as const;

const SCHEDULE_GRID_FIRST_HOUR = 6;
const SCHEDULE_GRID_LAST_HOUR = 22;

function isScheduleHourOpen(_dayCode: DayCode, hour: number): boolean {
  return hour >= SCHEDULE_GRID_FIRST_HOUR && hour <= SCHEDULE_GRID_LAST_HOUR;
}

interface GoogleCalendarEventImporterProps {
  accessToken: string;
  onImportUnavailable: (keys: ReadonlySet<string>) => void;
}

const GoogleCalendarEventImporter = ({
  accessToken,
  onImportUnavailable,
}: GoogleCalendarEventImporterProps) => {
  const [directoryCalendars, setDirectoryCalendars] = useState<GoogleCalendarSummary[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<GoogleCalendarSummary[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_DAYS_OPTIONS)[number]>(14);
  const [loadedEvents, setLoadedEvents] = useState<CalendarPickableEvent[]>([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{
    tone: "info" | "success" | "warning";
    message: string;
  } | null>(null);

  const resetLoadedCalendar = useCallback(() => {
    setLoadedEvents([]);
    setSelectedIds(new Set());
    setImportMessage(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingDirectory(true);
    setError(null);
    setDirectoryCalendars([]);
    setSelectedCalendars([]);
    resetLoadedCalendar();

    void fetchReadableCalendarList(accessToken)
      .then((list) => {
        if (cancelled) return;
        setDirectoryCalendars(list);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load your calendar list. Try disconnecting and signing in again.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDirectory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, resetLoadedCalendar]);

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

  const handleLoadEvents = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    setImportMessage(null);

    try {
      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date(timeMin);
      timeMax.setDate(timeMax.getDate() + rangeDays);

      if (selectedCalendars.length === 0) {
        setError("Choose at least one calendar to load events from.");
        return;
      }

      const { events, calendarWarnings } = await fetchPickableCalendarEvents({
        accessToken,
        timeMin,
        timeMax,
        includeTransparent: true,
        calendars: selectedCalendars,
      });
      setLoadedEvents(events);
      setSelectedIds(new Set());

      if (calendarWarnings.length > 0) {
        setImportMessage({
          tone: "warning",
          message:
            `Could not read ${calendarWarnings.length} calendar(s): ${calendarWarnings.join("; ")}.` +
            (events.length === 0 ? " No events were loaded." : ""),
        });
      } else if (events.length === 0) {
        setImportMessage({
          tone: "info",
          message: "No events matched in this date range for the calendars you selected.",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read Google Calendar.");
    } finally {
      setLoadingList(false);
    }
  }, [accessToken, rangeDays, selectedCalendars]);

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
    const keys = busyIntervalsToWeeklyHourSlotKeys(intervals, isScheduleHourOpen);
    onImportUnavailable(keys);

    if (keys.size === 0) {
      setImportMessage({
        tone: "warning",
        message:
          "None of the selected events overlap facility hours on the weekly grid. Pick different events or paint unavailable hours manually.",
      });
    } else {
      setImportMessage({
        tone: "success",
        message: `Marked ${keys.size} hourly slots unavailable from ${selectedIds.size} selected event(s).`,
      });
    }
  };

  const handleRangeChange = (e: SelectChangeEvent<number>) => {
    setRangeDays(Number(e.target.value) as (typeof RANGE_DAYS_OPTIONS)[number]);
    resetLoadedCalendar();
  };

  return (
    <div className="calendar-events-card">
      <p className="calendar-events-card-title">Pick calendar events as busy</p>
      <p className="calendar-events-card-copy">
        Choose calendars, load events, then check specific occurrences to block as unavailable on
        the grid below.
      </p>

      <div className="calendar-events-toolbar">
        <Autocomplete
          multiple
          fullWidth
          className="calendar-events-autocomplete"
          options={directoryCalendars}
          value={selectedCalendars}
          loading={loadingDirectory}
          disabled={loadingDirectory || directoryCalendars.length === 0}
          onChange={(_, newValue) => setSelectedCalendars(newValue)}
          getOptionLabel={(o) => o.summary}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          disableCloseOnSelect
          limitTags={3}
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

        <div className="calendar-events-toolbar-actions">
          <button
            className="calendar-events-text-button"
            type="button"
            onClick={() => setSelectedCalendars(directoryCalendars)}
          >
            All calendars
          </button>
          <button
            className="calendar-events-text-button"
            type="button"
            onClick={() => setSelectedCalendars([])}
          >
            Clear calendars
          </button>
        </div>
      </div>

      <div className="calendar-events-controls">
        <FormControl size="small" className="calendar-events-range">
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

        <button
          className="calendar-link-button"
          type="button"
          disabled={loadingList || selectedCalendars.length === 0 || loadingDirectory}
          onClick={() => void handleLoadEvents()}
        >
          {loadingList ? "Loading events..." : "Load calendar events"}
        </button>

        <button
          className="primary-button calendar-events-import-button"
          type="button"
          disabled={loadedEvents.length === 0 || selectedIds.size === 0 || loadingList}
          onClick={handleImportSelected}
        >
          Import selected as unavailable
        </button>
      </div>

      {loadedEvents.length > 0 && (
        <div className="calendar-events-list-shell">
          <div className="calendar-events-list-toolbar">
            <span>
              {selectedIds.size} of {loadedEvents.length} selected
            </span>
            <button
              className="calendar-events-text-button"
              type="button"
              onClick={() => setSelectedIds(new Set(loadedEvents.map((ev) => ev.pickKey)))}
            >
              Select all
            </button>
            <button
              className="calendar-events-text-button"
              type="button"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
          </div>

          <ul className="calendar-events-list">
            {loadedEvents.map((ev) => (
              <li key={ev.pickKey}>
                <label
                  className={`calendar-events-list-item${selectedIds.has(ev.pickKey) ? " selected" : ""}`}
                >
                  <input
                    checked={selectedIds.has(ev.pickKey)}
                    type="checkbox"
                    onChange={() => toggleEventId(ev.pickKey)}
                  />
                  <span className="calendar-events-list-body">
                    <span className="calendar-events-list-title">{ev.summary}</span>
                    <span className="calendar-events-list-meta">{ev.calendarLabel}</span>
                    <span
                      className={`calendar-events-list-time${ev.shownAsFree ? " free-event" : ""}`}
                    >
                      {ev.timeRangeLabel}
                      {ev.shownAsFree ? " · marked Free in Google" : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="calendar-link-error">{error}</p>}
      {importMessage && (
        <p className={`calendar-events-banner calendar-events-banner--${importMessage.tone}`}>
          {importMessage.message}
        </p>
      )}
    </div>
  );
};

export default GoogleCalendarEventImporter;
