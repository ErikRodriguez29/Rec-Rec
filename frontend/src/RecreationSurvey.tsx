import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import GoogleCalendarBusyImporter from "./GoogleCalendarBusyImporter";
import RecommendationsDisplay from "./RecommendationsDisplay";
import { isRecommendationsPayload, type RecommendationsPayload } from "./recommendationsTypes";

const SCHEDULE_DAYS = [
  { code: "m", label: "Mon" },
  { code: "t", label: "Tue" },
  { code: "w", label: "Wed" },
  { code: "r", label: "Thu" },
  { code: "f", label: "Fri" },
  { code: "s", label: "Sat" },
  { code: "u", label: "Sun" },
] as const;

type DayCode = (typeof SCHEDULE_DAYS)[number]["code"];

/** Main facility standard hours (hour indices are the labeled hour on the grid, 24h clock). */
const MAIN_FACILITY_HOURS: Record<DayCode, { start: number; end: number }> = {
  m: { start: 6, end: 23 },
  t: { start: 6, end: 23 },
  w: { start: 6, end: 23 },
  r: { start: 6, end: 23 },
  f: { start: 6, end: 21 },
  s: { start: 9, end: 21 },
  u: { start: 9, end: 22 },
};

function isMainFacilityHourOpen(dayCode: string, hour: number) {
  const bounds = MAIN_FACILITY_HOURS[dayCode as DayCode];
  if (!bounds) return false;
  return hour >= bounds.start && hour <= bounds.end;
}

/** Rows shown: union span covering every day’s open window (6 a.m.–11 p.m. slot labels). */
const SCHEDULE_GRID_FIRST_HOUR = 6;
const SCHEDULE_GRID_LAST_HOUR = 23;
const SCHEDULE_HOUR_ROWS = Array.from(
  { length: SCHEDULE_GRID_LAST_HOUR - SCHEDULE_GRID_FIRST_HOUR + 1 },
  (_, i) => SCHEDULE_GRID_FIRST_HOUR + i,
);

function filterSlotsToStandardHours(slots: Set<string>) {
  const next = new Set<string>();
  for (const key of slots) {
    const dash = key.lastIndexOf("-");
    const day = key.slice(0, dash);
    const hour = Number(key.slice(dash + 1));
    if (Number.isFinite(hour) && isMainFacilityHourOpen(day, hour)) next.add(key);
  }
  return next;
}

function slotKey(dayCode: string, hour: number) {
  return `${dayCode}-${hour}`;
}

function formatHourCompact(hour: number) {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

/** Encode grid selection as CLI `--preferred-days-hours` / `--unavailable-days-hours` segments. */
function serializeScheduleSlots(slots: ReadonlySet<string>): string {
  const byDay = new Map<string, number[]>();
  for (const key of slots) {
    const dash = key.lastIndexOf("-");
    const day = key.slice(0, dash);
    const h = Number(key.slice(dash + 1));
    if (!Number.isFinite(h)) continue;
    const list = byDay.get(day) ?? [];
    list.push(h);
    byDay.set(day, list);
  }
  const parts: string[] = [];
  for (const { code } of SCHEDULE_DAYS) {
    const hours = (byDay.get(code) ?? []).sort((a, b) => a - b);
    let i = 0;
    while (i < hours.length) {
      const start = hours[i];
      let end = start;
      while (i + 1 < hours.length && hours[i + 1] === end + 1) {
        i++;
        end = hours[i];
      }
      parts.push(`${code}; ${start}, ${end}`);
      i++;
    }
  }
  return parts.join("; ");
}

const PREFERRED_ACTIVITIES = [
  "racquetball",
  "squash",
  "ellipticals (precor branded machines)",
  "stairmasters (stair machines)",
  "treadmills",
  "basketball",
  "benching",
  "bike machines",
  "weight lifting",
  "badminton",
  "arm machines",
  "core machines",
  "leg presses",
  "arm & leg machines",
  "stairmasters",
  "weight crunch machines",
  "hockey",
  "skating",
  "swimming",
  "climbing",
] as const;

const PREFERRED_FACILITIES = [
  "Racquetball Court 1",
  "Racquetball Court 2",
  "Racquetball Court 3",
  "Racquetball Court 4",
  "Squash Court 1",
  "Galleria",
  "Main Gym Court 1 (North)",
  "Main Gym Court 2 (South)",
  "Outdoor Fitness 1 (Turf, Free Weights, Benches)",
  "Pavilion Court 1 (West)",
  "Pavilion Court 2 (East)",
  "Outdoor Fitness 2 (Behind Pottery)",
  "FC 1- North Room",
  "FC 1 - South Room",
  "FC 2 - 1st floor",
  "FC 2- Mezzanine",
  "FC 3 - MAC",
  "MAC Court",
  "Spa",
  "Small Pool",
  "Big Pool",
  "Pool Deck",
  "Climbing Center - MAC",
] as const;

const EXERCISE_CATEGORIES = ["cardio", "arms", "core", "legs", "weight training"] as const;

type YesNo = "yes" | "no" | "";

const googleCalendarConfigured = Boolean(
  import.meta.env.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID,
);

function joinCsv(items: readonly string[]) {
  return items.join(",");
}

type ScheduleBrush = "preferred" | "unavailable";

type ScheduleDragSession = { brush: ScheduleBrush; adding: boolean };

function WhenMeetScheduleGrid(props: {
  brush: ScheduleBrush;
  onBrushChange: (b: ScheduleBrush) => void;
  preferredSlots: ReadonlySet<string>;
  unavailableSlots: ReadonlySet<string>;
  scheduleDrag: ScheduleDragSession | null;
  onScheduleDragChange: (session: ScheduleDragSession | null) => void;
  paintScheduleCell: (key: string, brush: ScheduleBrush, adding: boolean) => void;
  isSelectable: (dayCode: string, hour: number) => boolean;
}) {
  const {
    brush,
    onBrushChange,
    preferredSlots,
    unavailableSlots,
    scheduleDrag,
    onScheduleDragChange,
    paintScheduleCell,
    isSelectable,
  } = props;

  const handlePointerDown =
    (dayCode: string, hour: number, key: string) => (e: ReactPointerEvent) => {
      if (!isSelectable(dayCode, hour)) return;
      if (brush === "preferred" && unavailableSlots.has(key)) return;
      if (brush === "unavailable" && preferredSlots.has(key)) return;
      e.preventDefault();
      const isPreferred = preferredSlots.has(key);
      const isUnavailable = unavailableSlots.has(key);
      const adding = brush === "preferred" ? !isPreferred : !isUnavailable;
      onScheduleDragChange({ brush, adding });
      paintScheduleCell(key, brush, adding);
    };

  const handlePointerEnter = (dayCode: string, hour: number, key: string) => () => {
    if (!isSelectable(dayCode, hour)) return;
    if (scheduleDrag === null) return;
    const { brush: dragBrush, adding } = scheduleDrag;
    if (adding) {
      if (dragBrush === "preferred" && unavailableSlots.has(key)) return;
      if (dragBrush === "unavailable" && preferredSlots.has(key)) return;
    }
    paintScheduleCell(key, scheduleDrag.brush, scheduleDrag.adding);
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Drawing mode
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={brush}
          onChange={(_, value: ScheduleBrush | null) => {
            if (value !== null) onBrushChange(value);
          }}
          aria-label="Schedule paint mode"
          sx={{ flexWrap: "wrap" }}
        >
          <ToggleButton
            value="preferred"
            sx={{
              textTransform: "none",
              "&.Mui-selected": {
                bgcolor: "success.light",
                color: "success.dark",
                "&:hover": { bgcolor: "success.light" },
              },
            }}
          >
            Preferred (green)
          </ToggleButton>
          <ToggleButton
            value="unavailable"
            sx={{
              textTransform: "none",
              "&.Mui-selected": {
                bgcolor: "error.light",
                color: "error.dark",
                "&:hover": { bgcolor: "error.light" },
              },
            }}
          >
            Unavailable (red)
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">
          Click or drag to paint. Starting on a filled cell clears that color for the whole stroke;
          starting on empty fills with the selected color. You cannot paint green on red hours or
          red on green — switch modes and clear a cell first if you need to change it.
        </Typography>
      </Stack>

      <Box
        sx={{
          overflow: "auto",
          maxHeight: { xs: 360, sm: 440 },
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "background.paper",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `52px repeat(${SCHEDULE_DAYS.length}, minmax(28px, 1fr))`,
            minWidth: { xs: 280, sm: "100%" },
          }}
        >
          <Box
            sx={{
              position: "sticky",
              top: 0,
              left: 0,
              zIndex: 3,
              bgcolor: "grey.100",
              borderBottom: 1,
              borderRight: 1,
              borderColor: "divider",
              height: 36,
            }}
          />
          {SCHEDULE_DAYS.map((d) => (
            <Box
              key={d.code}
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                bgcolor: "grey.100",
                borderBottom: 1,
                borderRight: 1,
                borderColor: "divider",
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "text.secondary",
              }}
            >
              {d.label}
            </Box>
          ))}

          {SCHEDULE_HOUR_ROWS.map((hour) => (
            <Box key={hour} sx={{ display: "contents" }}>
              <Box
                sx={{
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                  bgcolor: "grey.50",
                  borderBottom: 1,
                  borderRight: 1,
                  borderColor: "divider",
                  height: 22,
                  px: 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  fontSize: 10,
                  color: "text.secondary",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatHourCompact(hour)}
              </Box>
              {SCHEDULE_DAYS.map((d) => {
                const key = slotKey(d.code, hour);
                const isPreferred = preferredSlots.has(key);
                const isUnavailable = unavailableSlots.has(key);
                const open = isSelectable(d.code, hour);
                const filledBg = isPreferred
                  ? "success.light"
                  : isUnavailable
                    ? "error.light"
                    : null;
                const filledHover = isPreferred
                  ? "success.main"
                  : isUnavailable
                    ? "error.main"
                    : undefined;
                return (
                  <Box
                    key={key}
                    onPointerDown={handlePointerDown(d.code, hour, key)}
                    onPointerEnter={handlePointerEnter(d.code, hour, key)}
                    sx={{
                      borderBottom: 1,
                      borderRight: 1,
                      borderColor: "divider",
                      height: 22,
                      cursor: open ? "pointer" : "default",
                      userSelect: "none",
                      touchAction: open ? "none" : "auto",
                      pointerEvents: open ? "auto" : "none",
                      bgcolor: !open ? "grey.300" : (filledBg ?? "background.paper"),
                      opacity: open ? 1 : 0.45,
                      backgroundImage: !open
                        ? "repeating-linear-gradient(135deg, rgba(0,0,0,0.06) 0 4px, transparent 4px 8px)"
                        : undefined,
                      "&:hover": open
                        ? {
                            bgcolor: filledBg !== null ? filledHover : "action.hover",
                          }
                        : undefined,
                    }}
                  />
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>

      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {preferredSlots.size === 0
            ? "Preferred: (none)"
            : `Preferred: ${serializeScheduleSlots(preferredSlots)}`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {unavailableSlots.size === 0
            ? "Unavailable: (none)"
            : `Unavailable: ${serializeScheduleSlots(unavailableSlots)}`}
        </Typography>
      </Stack>
    </Stack>
  );
}

export default function RecreationSurvey() {
  const [activities, setActivities] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [preferredSlots, setPreferredSlots] = useState(() => new Set<string>());
  const [unavailableSlots, setUnavailableSlots] = useState(() => new Set<string>());
  const [scheduleBrush, setScheduleBrush] = useState<ScheduleBrush>("preferred");
  const [scheduleDrag, setScheduleDrag] = useState<ScheduleDragSession | null>(null);
  const [rainFilter, setRainFilter] = useState<YesNo>("");
  const [facilitiesHardFilter, setFacilitiesHardFilter] = useState<YesNo>("");
  const [submittedPreview, setSubmittedPreview] = useState<string | null>(null);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsPayload | null>(null);
  const [recommendationsSource, setRecommendationsSource] = useState<string | null>(null);
  const [recommendRunDetails, setRecommendRunDetails] = useState<{
    ok: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
  } | null>(null);

  useEffect(() => {
    const endDrag = () => {
      setScheduleDrag(null);
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  useEffect(() => {
    setPreferredSlots((prev) => filterSlotsToStandardHours(prev));
    setUnavailableSlots((prev) => filterSlotsToStandardHours(prev));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSaved = async () => {
      try {
        const res = await fetch("/api/recommendations");
        if (!res.ok || cancelled) return;
        const raw: unknown = await res.json();
        const data = raw as { recommendations?: unknown };
        if (isRecommendationsPayload(data.recommendations)) {
          setRecommendations(data.recommendations);
          setRecommendationsSource("Loaded from src/output/recommendations/recommendations.json");
        }
      } catch {
        // Dev server not running or file missing — ignore.
      }
    };
    void loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  const preferredDaysHours = useMemo(
    () => serializeScheduleSlots(preferredSlots),
    [preferredSlots],
  );
  const unavailableDaysHours = useMemo(
    () => serializeScheduleSlots(unavailableSlots),
    [unavailableSlots],
  );

  const mergeGoogleBusySlots = useCallback((keys: ReadonlySet<string>) => {
    setUnavailableSlots((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
    setPreferredSlots((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.delete(k);
      return next;
    });
  }, []);

  const paintScheduleCell = (key: string, brush: ScheduleBrush, adding: boolean) => {
    const dash = key.lastIndexOf("-");
    const day = key.slice(0, dash);
    const hour = Number(key.slice(dash + 1));
    if (!Number.isFinite(hour) || !isMainFacilityHourOpen(day, hour)) return;

    if (brush === "preferred") {
      setPreferredSlots((prev) => {
        const next = new Set(prev);
        if (adding) next.add(key);
        else next.delete(key);
        return next;
      });
    } else {
      setUnavailableSlots((prev) => {
        const next = new Set(prev);
        if (adding) next.add(key);
        else next.delete(key);
        return next;
      });
    }
  };

  const commandPreview = useMemo(() => {
    const parts: string[] = ["python recommend-times.py"];
    if (activities.length) parts.push(`--preferred-activities "${joinCsv(activities)}"`);
    if (facilities.length) parts.push(`--preferred-facilities "${facilities.join("; ")}"`);
    if (categories.length) parts.push(`--preferred-exercise-categories "${joinCsv(categories)}"`);
    if (preferredDaysHours.trim())
      parts.push(`--preferred-days-hours "${preferredDaysHours.trim()}"`);
    if (unavailableDaysHours.trim())
      parts.push(`--unavailable-days-hours "${unavailableDaysHours.trim()}"`);
    if (rainFilter) parts.push(`--rain-filter ${rainFilter}`);
    if (facilitiesHardFilter)
      parts.push(`--preferred-facilities-hard-filter ${facilitiesHardFilter}`);
    return parts.join(" \\\n  ");
  }, [
    activities,
    facilities,
    categories,
    preferredDaysHours,
    unavailableDaysHours,
    rainFilter,
    facilitiesHardFilter,
  ]);

  const handleYesNo = (setter: (v: YesNo) => void) => (e: SelectChangeEvent<YesNo>) => {
    setter(e.target.value as YesNo);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRecommendError(null);
    if (activities.length === 0 && categories.length === 0) {
      setSubmittedPreview(null);
      setRecommendations(null);
      setRecommendationsSource(null);
      setRecommendRunDetails(null);
      setRecommendError("Pick at least one preferred activity or exercise category.");
      return;
    }

    setSubmittedPreview(commandPreview);
    setRecommendRunDetails(null);

    type RecommendPayload = {
      preferredActivities?: string;
      preferredExerciseCategories?: string;
      preferredDaysHours?: string;
      unavailableDaysHours?: string;
      preferredFacilities?: string;
      rainFilter?: string;
      preferredFacilitiesHardFilter?: string;
    };
    const payload: RecommendPayload = {};
    if (activities.length) payload.preferredActivities = joinCsv(activities);
    if (categories.length) payload.preferredExerciseCategories = joinCsv(categories);
    if (facilities.length) payload.preferredFacilities = facilities.join("; ");
    if (preferredDaysHours.trim()) payload.preferredDaysHours = preferredDaysHours.trim();
    payload.unavailableDaysHours = unavailableDaysHours.trim().length
      ? unavailableDaysHours.trim()
      : "None";
    if (rainFilter) payload.rainFilter = rainFilter;
    if (facilitiesHardFilter) payload.preferredFacilitiesHardFilter = facilitiesHardFilter;

    setRecommendLoading(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw: unknown = await res.json();
      const data = raw as {
        ok?: boolean;
        stdout?: string;
        stderr?: string;
        exitCode?: number | null;
        error?: string;
        recommendations?: unknown;
      };

      if (!res.ok) {
        const errMsg =
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : `Recommendation request failed (HTTP ${res.status}).`;
        setRecommendError(errMsg);
        return;
      }

      const stdout = typeof data.stdout === "string" ? data.stdout : "";
      const stderr = typeof data.stderr === "string" ? data.stderr : "";
      setRecommendRunDetails({
        ok: Boolean(data.ok),
        stdout,
        stderr,
        exitCode:
          typeof data.exitCode === "number" || data.exitCode === null ? data.exitCode : null,
      });

      if (isRecommendationsPayload(data.recommendations)) {
        setRecommendations(data.recommendations);
        setRecommendationsSource(
          data.ok ? "Updated from src/output/recommendations/recommendations.json" : null,
        );
      } else if (data.ok) {
        setRecommendError("Recommender finished but recommendations.json was missing or invalid.");
      }
    } catch {
      setRecommendError(
        "Could not reach the recommendation runner. Run the app with `pnpm dev` (development server proxies /api/recommend to Python).",
      );
    } finally {
      setRecommendLoading(false);
    }
  };

  return (
    <Box sx={{ bgcolor: "grey.50", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="lg">
        <Stack spacing={3} component="form" onSubmit={handleSubmit}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
              Recreation time preferences
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Tell us how you like to train, then submit with Run recommender. In development this
              runs <code>src/scripts/recommender/recommend-times.py</code> and displays{" "}
              <code>src/output/recommendations/recommendations.json</code> below — overall visits
              for this week and next, plus per-activity options in the dropdown.
            </Typography>
          </Box>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
            <Stack spacing={3}>
              <Typography variant="h6">Activities &amp; workout focus</Typography>

              <Autocomplete
                multiple
                options={[...PREFERRED_ACTIVITIES]}
                value={activities}
                onChange={(_, v) => setActivities(v)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Preferred activities"
                    placeholder="Choose one or more"
                    helperText="Select everything you want included when recommending times."
                  />
                )}
              />

              <Autocomplete
                multiple
                options={[...EXERCISE_CATEGORIES]}
                value={categories}
                onChange={(_, v) => setCategories(v)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Preferred exercise categories"
                    placeholder="Choose one or more"
                  />
                )}
              />
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
            <Stack spacing={3}>
              <Typography variant="h6">Facilities</Typography>

              <Autocomplete
                multiple
                options={[...PREFERRED_FACILITIES]}
                value={facilities}
                onChange={(_, v) => setFacilities(v)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Preferred facilities"
                    placeholder="Choose one or more locations"
                  />
                )}
              />

              <FormControl fullWidth>
                <InputLabel id="facilities-hard-filter-label">Strict facility filter</InputLabel>
                <Select<YesNo>
                  labelId="facilities-hard-filter-label"
                  label="Strict facility filter"
                  value={facilitiesHardFilter}
                  onChange={handleYesNo(setFacilitiesHardFilter)}
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, display: "block" }}
                >
                  Matches <code>--preferred-facilities-hard-filter</code>: when yes, recommendations
                  only use facilities you selected above.
                </Typography>
              </FormControl>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Schedule
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Selectable cells follow{" "}
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    main facility standard hours
                  </Box>
                  : Monday–Thursday 6 a.m.–11 p.m.; Friday 6 a.m.–9 p.m.; Saturday 9 a.m.–9 p.m.;
                  Sunday 9 a.m.–10 p.m. Shaded blocks are outside those hours.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  For planning pools or the climbing center specifically:{" "}
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    Pools
                  </Box>{" "}
                  — Monday–Friday 6:30 a.m.–8 p.m.; Saturday–Sunday 9 a.m.–8 p.m.{" "}
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    Climbing Center
                  </Box>{" "}
                  — Monday–Thursday 11:30 a.m.–10 p.m.; Friday–Sunday 11:30 a.m.–8:30 p.m.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  One weekly grid (like When2Meet): pick green or red mode above, then click or drag
                  to mark preferred vs unavailable times.
                </Typography>
              </Box>

              {googleCalendarConfigured ? (
                <GoogleCalendarBusyImporter
                  isHourOpen={isMainFacilityHourOpen}
                  onMergeBusySlots={mergeGoogleBusySlots}
                />
              ) : (
                <Alert severity="info">
                  To pick Google Calendar events as busy times, create an OAuth Web Client ID,
                  enable the Calendar API for that project, then set <code>GOOGLE_CLIENT_ID</code>{" "}
                  in the project <code>.env</code> file. Add your dev origin (for example{" "}
                  <code>http://localhost:5173</code>) under Authorized JavaScript origins. Keep{" "}
                  <code>GOOGLE_CLIENT_SECRET</code> server-side only — this app uses the public
                  client id and does not bundle the secret.
                </Alert>
              )}

              <WhenMeetScheduleGrid
                brush={scheduleBrush}
                onBrushChange={setScheduleBrush}
                preferredSlots={preferredSlots}
                unavailableSlots={unavailableSlots}
                scheduleDrag={scheduleDrag}
                onScheduleDragChange={setScheduleDrag}
                paintScheduleCell={paintScheduleCell}
                isSelectable={isMainFacilityHourOpen}
              />

              <FormControl fullWidth>
                <InputLabel id="rain-filter-label">Rain filter</InputLabel>
                <Select<YesNo>
                  labelId="rain-filter-label"
                  label="Rain filter"
                  value={rainFilter}
                  onChange={handleYesNo(setRainFilter)}
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, display: "block" }}
                >
                  Matches <code>--rain-filter</code> for outdoor-sensitive planning.
                </Typography>
              </FormControl>
            </Stack>
          </Paper>

          <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
            <Button
              type="button"
              variant="outlined"
              onClick={() => {
                setActivities([]);
                setFacilities([]);
                setCategories([]);
                setPreferredSlots(new Set());
                setUnavailableSlots(new Set());
                setScheduleBrush("preferred");
                setScheduleDrag(null);
                setRainFilter("");
                setFacilitiesHardFilter("");
                setSubmittedPreview(null);
                setRecommendLoading(false);
                setRecommendError(null);
                setRecommendations(null);
                setRecommendationsSource(null);
                setRecommendRunDetails(null);
              }}
            >
              Clear
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={recommendLoading}
              startIcon={
                recommendLoading ? (
                  <CircularProgress color="inherit" size={18} thickness={6} />
                ) : undefined
              }
              sx={recommendLoading ? { "& .MuiButton-startIcon": { mr: 1 } } : {}}
            >
              Run recommender
            </Button>
          </Stack>

          {recommendError !== null && <Alert severity="error">{recommendError}</Alert>}

          {submittedPreview !== null && (
            <Alert severity="info" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              <Typography variant="subtitle2" gutterBottom>
                Equivalent CLI (for reference)
              </Typography>
              {submittedPreview}
            </Alert>
          )}

          {recommendations !== null && (
            <Paper elevation={0} variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Your recommendations
                </Typography>
                <RecommendationsDisplay
                  data={recommendations}
                  sourceNote={recommendationsSource ?? undefined}
                />
              </Stack>
            </Paper>
          )}

          {recommendRunDetails !== null &&
            (!recommendRunDetails.ok || recommendRunDetails.stderr.trim().length > 0) && (
              <Paper elevation={0} variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {recommendRunDetails.ok ? "Runner log" : "Recommender error details"}
                  </Typography>
                  {!recommendRunDetails.ok && (
                    <Alert severity="warning">
                      Exit code {recommendRunDetails.exitCode ?? "unknown"}.
                    </Alert>
                  )}
                  <Typography
                    component="pre"
                    variant="body2"
                    sx={{
                      m: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: '"JetBrains Mono", "Roboto Mono", ui-monospace, monospace',
                      fontSize: 13,
                    }}
                  >
                    {(() => {
                      const blocks: string[] = [];
                      if (recommendRunDetails.stderr.trim().length > 0)
                        blocks.push("--- stderr ---\n" + recommendRunDetails.stderr.trim());
                      if (!recommendRunDetails.ok && recommendRunDetails.stdout.trim().length > 0)
                        blocks.push(recommendRunDetails.stdout.trim());
                      return blocks.filter((b) => b.length > 0).join("\n\n") || "(no output)";
                    })()}
                  </Typography>
                </Stack>
              </Paper>
            )}
        </Stack>
      </Container>
    </Box>
  );
}
