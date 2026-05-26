import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsPayload | null>(null);

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

  const handleYesNo = (setter: (v: YesNo) => void) => (e: SelectChangeEvent<YesNo>) => {
    setter(e.target.value as YesNo);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRecommendError(null);
    if (activities.length === 0 && categories.length === 0) {
      setRecommendations(null);
      setRecommendError("Pick at least one preferred activity or exercise category.");
      return;
    }

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

    setRecommendations(null);
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
        setRecommendError(
          "We couldn't generate your recommendations right now. Please try again in a moment.",
        );
        return;
      }

      if (!data.ok) {
        setRecommendError(
          "Something went wrong while building your schedule. Please review your preferences and try again.",
        );
        return;
      }

      if (isRecommendationsPayload(data.recommendations)) {
        setRecommendations(data.recommendations);
      } else {
        setRecommendError(
          "Your schedule was processed, but we couldn't display the results. Please try again.",
        );
      }
    } catch {
      setRecommendError(
        "We couldn't reach the server to generate recommendations. Check your connection and try again.",
      );
    } finally {
      setRecommendLoading(false);
    }
  };

  return (
    <Box sx={{ bgcolor: "grey.50", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="lg">
        <Stack spacing={3} component="form" onSubmit={handleSubmit}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
            UCSB Recreation Recommender
          </Typography>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Preferred exercise categories
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  General workout categories you&apos;d like to train for. We&apos;ll recommend the
                  best facilities and times for these categories, but you may want to pick specific
                  activities in the preferred activities field instead. This field is optional and
                  you may choose to enter only preferred activities if needed, but one of the two
                  fields must be filled.
                </Typography>
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
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Preferred activities
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Specialized activities you&apos;d like to do. Select everything you want included
                  when recommending times. This field is optional and you may pick only general
                  preferred exercise categories if needed, but one of the two fields must be filled.
                </Typography>
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
                    />
                  )}
                />
              </Box>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Facilities
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enter your preferred facilities. See the collapsible menu for help locating your
                  preferred facilities. Toggle the strict facility filter if you strictly only want
                  us to recommend your preferred facilities; otherwise we&apos;ll try to recommend
                  your preferred facilities but will be flexible if they happen to be full. Note
                  this may cause recommendations to be empty if we can&apos;t find facilities with
                  your preferred activities when the strict facility filter is on.
                </Typography>
              </Box>

              <Accordion
                defaultExpanded={false}
                disableGutters
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  "&:before": { display: "none" },
                }}
              >
                <AccordionSummary aria-controls="facility-help-content" id="facility-help-header">
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Help locating your preferred facilities
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary">
                    Facility location guide — coming soon.
                  </Typography>
                </AccordionDetails>
              </Accordion>

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
              </FormControl>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Schedule
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Draw in your preferred hours to go to the gym and your unavailable hours in the
                  following weekly grid. Sign in with Google to import your calendar events for when
                  you are busy, or draw your unavailable hours manually. We&apos;ll try to recommend
                  times within your preferred hours, but we&apos;ll be flexible in case your
                  preferred facilities happen to be full.
                </Typography>
              </Box>

              {googleCalendarConfigured ? (
                <GoogleCalendarBusyImporter
                  isHourOpen={isMainFacilityHourOpen}
                  onMergeBusySlots={mergeGoogleBusySlots}
                />
              ) : null}

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
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1.5, display: "block" }}
                >
                  We&apos;ll try to recommend times which don&apos;t observe rainy weather, but in
                  case this is a hard blocker for you, indicate so above.
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
                setRecommendLoading(false);
                setRecommendError(null);
                setRecommendations(null);
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
              Get recommendations
            </Button>
          </Stack>

          {recommendError !== null && <Alert severity="error">{recommendError}</Alert>}

          {recommendations !== null && (
            <Paper elevation={0} variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Your recommendations
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    A suggested visit for each day this week and next, plus detailed options when
                    you focus on a specific activity or workout type.
                  </Typography>
                </Box>
                <RecommendationsDisplay data={recommendations} />
              </Stack>
            </Paper>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
