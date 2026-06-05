import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  dateFnsLocalizer,
  type Event as CalendarEvent,
  type View,
} from "react-big-calendar";
import { createEvents, type EventAttributes } from "ics";
import { addDays, format, getDay, parse, startOfDay, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { DAY_CONFIGS } from "../../constants";
import type { OverallRec, RecommendationResult, WeekRecs } from "../../types";
import {
  createGoogleCalendar,
  fetchWritableCalendarList,
  getGoogleCalendarAccessToken,
  insertGoogleCalendarEvents,
  requireGoogleCalendarAccessToken,
  type GoogleCalendarSummary,
} from "../../api/googleCalendar";
import { useGoogleCalendarLink } from "../../useGoogleCalendarLink";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./RecommendationCalendarExport.css";

type WeekKey = "current" | "next";
type DownloadScope = WeekKey | "both";

const EXPORT_SCOPE_OPTIONS: { value: DownloadScope; label: string }[] = [
  { value: "current", label: "Current week" },
  { value: "next", label: "Next week" },
  { value: "both", label: "Both weeks" },
];

const CALENDAR_PREVIEW_MIN = new Date(1970, 0, 1, 6, 0, 0);
const CALENDAR_PREVIEW_MAX = new Date(1970, 0, 1, 23, 0, 0);

interface RecommendationCalendarExportProps {
  result: RecommendationResult;
  previewWeek: WeekKey;
  onPreviewWeekChange: (week: WeekKey) => void;
  name: string;
}

const AGENDA_DAY_COUNT = 14;

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
    score: number;
  };
}

const CalendarEventCard = ({ event }: { event: RecommendationCalendarEvent; title?: string }) => {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const { activity, facility, time, score } = event.resource;

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!wrapRef.current) return;

      const rect = wrapRef.current.getBoundingClientRect();
      const popupHeight = popupRef.current?.offsetHeight ?? 0;
      const gap = 4;
      const popupWidth = 220;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - popupWidth - 8));
      let top = rect.top - gap;

      if (popupHeight > 0 && top - popupHeight < 8) {
        top = popupHeight + 8;
      }

      setPopupStyle({ top, left });
    };

    const handleClickOutside = (mouseEvent: MouseEvent) => {
      const target = mouseEvent.target as Node;

      if (wrapRef.current?.contains(target) || popupRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="calendar-event-card-wrap" ref={wrapRef}>
      <button
        className="calendar-event-card"
        type="button"
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <span className="calendar-event-title">{activity}</span>
        <span className="calendar-event-facility">{facility}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="calendar-event-detail-popup"
            role="dialog"
            style={popupStyle}
            aria-labelledby={titleId}
          >
            <p className="calendar-event-detail-title" id={titleId}>
              Best time
            </p>
            <dl className="calendar-event-detail-list">
              <div>
                <dt>Activity / category</dt>
                <dd>{activity}</dd>
              </div>
              <div>
                <dt>Facility</dt>
                <dd>{facility}</dd>
              </div>
              <div>
                <dt>Time of day</dt>
                <dd>{time}</dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>{score.toFixed(1)}</dd>
              </div>
            </dl>
          </div>,
          document.body,
        )}
    </div>
  );
};

const weekStartOptions = { weekStartsOn: 1 as const };

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, weekStartOptions),
  getDay,
  locales,
});

const dayOffsetByValue: Record<string, number> = Object.fromEntries(
  DAY_CONFIGS.flatMap(({ code, name }, index) => [
    [code, index],
    [name.toUpperCase(), index],
    [name.slice(0, 3).toUpperCase(), index],
  ]),
);

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
  const weekStart = startOfWeek(new Date(), weekStartOptions);
  weekStart.setHours(0, 0, 0, 0);

  return week === "current" ? weekStart : addDays(weekStart, 7);
};

const getWeekKeyForDate = (date: Date): WeekKey | null => {
  const weekStart = startOfWeek(date, weekStartOptions);
  weekStart.setHours(0, 0, 0, 0);

  const currentStart = getWeekBaseDate("current");
  const nextStart = getWeekBaseDate("next");

  if (weekStart.getTime() === currentStart.getTime()) return "current";
  if (weekStart.getTime() === nextStart.getTime()) return "next";

  return null;
};

const toPreviewUnit = (date: Date, byWeek: boolean) => {
  const unit = byWeek ? startOfWeek(date, weekStartOptions) : startOfDay(date);
  unit.setHours(0, 0, 0, 0);
  return unit;
};

const buildPreviewBounds = (events: RecommendationCalendarEvent[]) => {
  const days = new Map<number, Date>();
  const weeks = new Map<number, Date>();

  for (const event of events) {
    const day = startOfDay(event.start);
    days.set(day.getTime(), day);

    const week = startOfWeek(event.start, weekStartOptions);
    week.setHours(0, 0, 0, 0);
    weeks.set(week.getTime(), week);
  }

  const sortDates = (entries: Map<number, Date>) =>
    [...entries.values()].sort((left, right) => left.getTime() - right.getTime());

  return { days: sortDates(days), weeks: sortDates(weeks) };
};

const clampPreviewDate = (
  allowed: Date[],
  newDate: Date,
  currentDate: Date,
  action: string | undefined,
  byWeek: boolean,
) => {
  if (allowed.length === 0) return newDate;

  const unitKey = (date: Date) => toPreviewUnit(date, byWeek).getTime();
  const targetMs = unitKey(newDate);

  if (allowed.some((date) => unitKey(date) === targetMs)) {
    return toPreviewUnit(newDate, byWeek);
  }

  const currentMs = unitKey(currentDate);
  const sorted = [...allowed].sort((left, right) => unitKey(left) - unitKey(right));

  if (action === "PREV") {
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
      if (unitKey(sorted[index]) < currentMs) return toPreviewUnit(sorted[index], byWeek);
    }
    return toPreviewUnit(sorted[0], byWeek);
  }

  if (action === "NEXT") {
    for (const date of sorted) {
      if (unitKey(date) > currentMs) return toPreviewUnit(date, byWeek);
    }
    return toPreviewUnit(sorted[sorted.length - 1], byWeek);
  }

  const closest = sorted.reduce((best, date) =>
    Math.abs(unitKey(date) - targetMs) < Math.abs(unitKey(best) - targetMs) ? date : best,
  );
  return toPreviewUnit(closest, byWeek);
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
    .map((rec: OverallRec) => {
      const day = rec.day || getRecString(rec, ["day"]);
      const activity = getRecString(rec, [
        "activity",
        "category",
        "activityOrCategory",
        "activity_or_category",
      ]);
      const facility =
        rec.facility || getRecString(rec, ["facility", "facilityName", "facility_name"]);
      const time =
        rec.time ||
        getRecString(rec, ["bestTime", "best_time", "time", "timeOfDay", "time_of_day"]);

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
          activity: activity || rec.category || "Activity",
          facility: facility || "Facility",
          day,
          time,
          score: rec.score,
        },
      };
    })
    .filter((event): event is RecommendationCalendarEvent => event !== null);
};

const buildExportEvents = (result: RecommendationResult, scope: DownloadScope) => {
  if (scope === "both") {
    return [
      ...buildCalendarEvents(result.currentWeek, "current"),
      ...buildCalendarEvents(result.nextWeek, "next"),
    ];
  }

  const recs = scope === "current" ? result.currentWeek : result.nextWeek;
  return buildCalendarEvents(recs, scope);
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

interface ExportButtonGroupProps {
  actionLabel: string;
  disabled: boolean;
  loading?: boolean;
  menuOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onAction: () => void;
  onScopeChange: (scope: DownloadScope) => void;
  onToggleMenu: () => void;
  scope: DownloadScope;
  tone: "ics" | "google";
}

const ExportButtonGroup = ({
  actionLabel,
  disabled,
  loading = false,
  menuOpen,
  menuRef,
  onAction,
  onScopeChange,
  onToggleMenu,
  scope,
  tone,
}: ExportButtonGroupProps) => (
  <div className={`calendar-export-group calendar-export-group--${tone}`} ref={menuRef}>
    <button
      type="button"
      className="calendar-export-button"
      disabled={disabled || loading}
      onClick={onAction}
    >
      {loading ? "Adding..." : actionLabel}
    </button>

    <button
      aria-expanded={menuOpen}
      aria-label={`Choose weeks for ${actionLabel}`}
      className="calendar-export-menu-button"
      type="button"
      onClick={onToggleMenu}
    >
      ▾
    </button>

    {menuOpen && (
      <div className="calendar-export-menu">
        {EXPORT_SCOPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={scope === option.value ? "active" : ""}
            type="button"
            onClick={() => onScopeChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

const RecommendationCalendarExport = ({
  result,
  previewWeek,
  onPreviewWeekChange,
  name,
}: RecommendationCalendarExportProps) => {
  const [calendarView, setCalendarView] = useState<View>("week");
  const [calendarDate, setCalendarDate] = useState(() => getWeekBaseDate(previewWeek));
  const [icsScope, setIcsScope] = useState<DownloadScope>("both");
  const [googleScope, setGoogleScope] = useState<DownloadScope>("both");
  const [icsMenuOpen, setIcsMenuOpen] = useState(false);
  const [googleMenuOpen, setGoogleMenuOpen] = useState(false);
  const [googleExporting, setGoogleExporting] = useState(false);
  const [googleExportSuccess, setGoogleExportSuccess] = useState<string | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarSummary[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState("primary");
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [creatingCalendar, setCreatingCalendar] = useState(false);
  const [showNewCalendar, setShowNewCalendar] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState("");
  const {
    linked: googleLinked,
    loading: linkingGoogle,
    error: calendarError,
    link: linkGoogleCalendar,
    setError: setCalendarError,
  } = useGoogleCalendarLink();
  const icsMenuRef = useRef<HTMLDivElement>(null);
  const googleMenuRef = useRef<HTMLDivElement>(null);

  const loadGoogleCalendars = useCallback(async () => {
    const token = getGoogleCalendarAccessToken();
    if (!token) return;

    setLoadingCalendars(true);

    try {
      const list = await fetchWritableCalendarList(token);
      setGoogleCalendars(list);

      setSelectedCalendarId((current) => {
        if (list.some((calendar) => calendar.id === current)) return current;
        if (list.some((calendar) => calendar.id === "primary")) return "primary";
        return list[0]?.id ?? "primary";
      });
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "Could not load Google calendars.");
    } finally {
      setLoadingCalendars(false);
    }
  }, [setCalendarError]);

  useEffect(() => {
    if (!googleLinked) return;

    void loadGoogleCalendars();
  }, [googleLinked, loadGoogleCalendars]);

  useEffect(() => {
    if (!icsMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!icsMenuRef.current) return;

      if (!icsMenuRef.current.contains(event.target as Node)) {
        setIcsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [icsMenuOpen]);

  useEffect(() => {
    if (!googleMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!googleMenuRef.current) return;

      if (!googleMenuRef.current.contains(event.target as Node)) {
        setGoogleMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [googleMenuOpen]);

  const previewEvents = useMemo(() => buildExportEvents(result, "both"), [result]);
  const previewBounds = useMemo(() => buildPreviewBounds(previewEvents), [previewEvents]);

  useEffect(() => {
    if (calendarView === "agenda") {
      setCalendarDate(getWeekBaseDate("current"));
      return;
    }

    setCalendarDate(getWeekBaseDate(previewWeek));
  }, [previewWeek, calendarView]);

  const handleCalendarNavigate = useCallback(
    (newDate: Date, view: View, action?: string) => {
      if (view === "agenda") {
        setCalendarDate(newDate);
        return;
      }

      const resolved =
        view === "week"
          ? clampPreviewDate(previewBounds.weeks, newDate, calendarDate, action, true)
          : view === "day"
            ? clampPreviewDate(previewBounds.days, newDate, calendarDate, action, false)
            : newDate;

      setCalendarDate(resolved);

      const week = getWeekKeyForDate(resolved);
      if (week && week !== previewWeek) {
        onPreviewWeekChange(week);
      }
    },
    [calendarDate, onPreviewWeekChange, previewBounds, previewWeek],
  );

  const handleCalendarViewChange = useCallback((view: View) => {
    setCalendarView(view);

    if (view === "agenda") {
      setCalendarDate(getWeekBaseDate("current"));
    }
  }, []);

  const icsEvents = useMemo(() => buildExportEvents(result, icsScope), [result, icsScope]);
  const googleEvents = useMemo(() => buildExportEvents(result, googleScope), [result, googleScope]);

  const handleDownloadIcs = () => {
    const events: EventAttributes[] = icsEvents.map((event) => ({
      title: event.title,
      description: `${event.resource.activity} at ${event.resource.facility}`,
      location: event.resource.facility,
      start: dateToIcsTuple(event.start),
      end: dateToIcsTuple(event.end),
      startInputType: "local",
      endInputType: "local",
    }));

    const { error, value } = createEvents(events);

    if (error || !value) {
      return;
    }

    const safeName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const scopeLabel = icsScope === "both" ? "both-weeks" : `${icsScope}-week`;

    downloadTextFile(`${safeName || "recommendations"}-${scopeLabel}.ics`, value);
  };

  const handleLinkGoogleCalendar = () => {
    setGoogleExportSuccess(null);
    void linkGoogleCalendar();
  };

  const handleCreateCalendar = async () => {
    const summary = newCalendarName.trim();
    if (!summary || creatingCalendar) return;

    setCreatingCalendar(true);
    setGoogleExportSuccess(null);
    setCalendarError(null);

    try {
      const token = requireGoogleCalendarAccessToken();
      const created = await createGoogleCalendar(token, summary);
      setGoogleCalendars((current) => [...current, created]);
      setSelectedCalendarId(created.id);
      setNewCalendarName("");
      setShowNewCalendar(false);
    } catch (error) {
      setCalendarError(
        error instanceof Error ? error.message : "Could not create Google Calendar.",
      );
    } finally {
      setCreatingCalendar(false);
    }
  };

  const handleAddToGoogleCalendar = async () => {
    if (googleExporting || googleEvents.length === 0 || !googleLinked) return;

    setGoogleExporting(true);
    setGoogleExportSuccess(null);
    setCalendarError(null);

    try {
      const token = requireGoogleCalendarAccessToken();

      let calendars = googleCalendars;

      if (calendars.length === 0) {
        calendars = await fetchWritableCalendarList(token);
        setGoogleCalendars(calendars);
      }

      const calendarId =
        calendars.find((calendar) => calendar.id === selectedCalendarId)?.id ?? selectedCalendarId;

      const created = await insertGoogleCalendarEvents(
        token,
        googleEvents.map((event) => ({
          title: event.title,
          description: `${event.resource.activity} at ${event.resource.facility}`,
          location: event.resource.facility,
          start: event.start,
          end: event.end,
        })),
        calendarId,
      );

      const calendarLabel =
        calendars.find((calendar) => calendar.id === calendarId)?.summary ?? "Google Calendar";

      setGoogleExportSuccess(
        `Successfully added ${created} event${created === 1 ? "" : "s"} to ${calendarLabel}.`,
      );
    } catch (error) {
      setCalendarError(
        error instanceof Error ? error.message : "Could not add events to Google Calendar.",
      );
    } finally {
      setGoogleExporting(false);
    }
  };

  return (
    <section className="recommendation-calendar-export">
      <div className="recommendation-calendar-header">
        <div>
          <p className="recommendation-calendar-eyebrow">
            {previewWeek === "current" ? "Current week" : "Next week"}
          </p>
          <h3>Calendar Preview</h3>
          <p className="recommendation-calendar-copy">
            Preview this schedule, download an .ics file, or add events to Google Calendar.
          </p>
        </div>

        <div className="calendar-export-actions">
          <div className="calendar-export-groups">
            <div className="google-calendar-target">
              <label className="google-calendar-target-label" htmlFor="google-export-calendar">
                Export to
              </label>

              {!googleLinked ? (
                <button
                  className="calendar-link-button"
                  disabled={linkingGoogle || loadingCalendars}
                  type="button"
                  onClick={handleLinkGoogleCalendar}
                >
                  {linkingGoogle || loadingCalendars ? "Connecting..." : "Link Google Calendar"}
                </button>
              ) : (
                <>
                  <select
                    className="google-calendar-target-select"
                    disabled={loadingCalendars || creatingCalendar}
                    id="google-export-calendar"
                    value={selectedCalendarId}
                    onChange={(event) => setSelectedCalendarId(event.target.value)}
                  >
                    {loadingCalendars && googleCalendars.length === 0 ? (
                      <option value="primary">Loading calendars...</option>
                    ) : (
                      googleCalendars.map((calendar) => (
                        <option key={calendar.id} value={calendar.id}>
                          {calendar.summary}
                        </option>
                      ))
                    )}
                  </select>

                  {!showNewCalendar ? (
                    <button
                      className="calendar-link-button calendar-link-button--compact"
                      type="button"
                      onClick={() => setShowNewCalendar(true)}
                    >
                      Create new calendar
                    </button>
                  ) : (
                    <div className="google-calendar-create">
                      <input
                        className="google-calendar-create-input"
                        placeholder="New calendar name"
                        type="text"
                        value={newCalendarName}
                        onChange={(event) => setNewCalendarName(event.target.value)}
                      />
                      <button
                        className="calendar-export-text-button"
                        disabled={creatingCalendar || newCalendarName.trim().length === 0}
                        type="button"
                        onClick={() => void handleCreateCalendar()}
                      >
                        {creatingCalendar ? "Creating..." : "Create"}
                      </button>
                      <button
                        className="calendar-export-text-button"
                        type="button"
                        onClick={() => {
                          setShowNewCalendar(false);
                          setNewCalendarName("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}

              {googleLinked && (
                <ExportButtonGroup
                  actionLabel="Add to Google Calendar"
                  disabled={googleEvents.length === 0}
                  loading={googleExporting}
                  menuOpen={googleMenuOpen}
                  menuRef={googleMenuRef}
                  scope={googleScope}
                  tone="google"
                  onAction={() => void handleAddToGoogleCalendar()}
                  onScopeChange={(scope) => {
                    setGoogleScope(scope);
                    setGoogleMenuOpen(false);
                  }}
                  onToggleMenu={() => setGoogleMenuOpen((open) => !open)}
                />
              )}

              {googleExportSuccess && <p className="calendar-link-status">{googleExportSuccess}</p>}

              {calendarError && <p className="calendar-link-error">{calendarError}</p>}
            </div>

            <ExportButtonGroup
              actionLabel="Download .ics"
              disabled={icsEvents.length === 0}
              menuOpen={icsMenuOpen}
              menuRef={icsMenuRef}
              scope={icsScope}
              tone="ics"
              onAction={handleDownloadIcs}
              onScopeChange={(scope) => {
                setIcsScope(scope);
                setIcsMenuOpen(false);
              }}
              onToggleMenu={() => setIcsMenuOpen((open) => !open)}
            />
          </div>
        </div>
      </div>

      {previewEvents.length === 0 ? (
        <div className="recommendation-calendar-empty">
          <h4>No calendar events found</h4>
          <p>The planner did not return readable day/time recommendations.</p>
        </div>
      ) : (
        <div className="recommendation-calendar-shell">
          <Calendar
            localizer={localizer}
            events={previewEvents}
            date={calendarDate}
            view={calendarView}
            views={["week", "day", "agenda"]}
            length={calendarView === "agenda" ? AGENDA_DAY_COUNT : undefined}
            startAccessor="start"
            endAccessor="end"
            titleAccessor="title"
            min={CALENDAR_PREVIEW_MIN}
            max={CALENDAR_PREVIEW_MAX}
            scrollToTime={CALENDAR_PREVIEW_MIN}
            toolbar
            popup
            onNavigate={handleCalendarNavigate}
            onView={handleCalendarViewChange}
            components={{
              event: CalendarEventCard,
            }}
          />
        </div>
      )}
    </section>
  );
};

export default RecommendationCalendarExport;
