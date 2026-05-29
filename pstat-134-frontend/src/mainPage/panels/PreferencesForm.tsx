import { useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { ACTIVITIES, DAY_CONFIGS, EXERCISE_CATEGORIES, FACILITIES } from "../../constants";
import TimeGrid from "../components/TimeGrid";
import CalendarImport from "../components/CalendarImport";
import type { DayCode, DayHourEntry, SlotState, UserPreferences } from "../../types";

interface PreferencesFormProps {
  onSubmit: (prefs: UserPreferences) => void;
  loading: boolean;
}

const DAY_ORDER_ARR = DAY_CONFIGS.map((c) => c.code);
const DAY_SHORT = Object.fromEntries(DAY_CONFIGS.map(({ code, name }) => [code, name.slice(0, 3)]));

const toLabel = (h: number): string => {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
};

const filterSlots = (slotMap: Map<string, SlotState>, state: SlotState): Set<string> =>
  new Set([...slotMap.entries()].filter(([, v]) => v === state).map(([k]) => k));

const slotsToRanges = (slots: Set<string>): DayHourEntry[] => {
  const byDay = new Map<string, number[]>();
  for (const slot of slots) {
    const day = slot[0];
    const hour = Number(slot.slice(2));
    const existing = byDay.get(day);
    if (existing) existing.push(hour);
    else byDay.set(day, [hour]);
  }
  return DAY_ORDER_ARR.filter((d) => byDay.has(d)).map((d) => {
    const hours = (byDay.get(d) ?? []).sort((a, b) => a - b);
    return { day: d as DayCode, startHour: hours[0], endHour: hours[hours.length - 1] };
  });
};

const slotsSummary = (slots: Set<string>): string => {
  if (slots.size === 0) return "";
  const byDay = new Map<string, number[]>();
  for (const slot of slots) {
    const day = slot[0];
    const hour = Number(slot.slice(2));
    const existing = byDay.get(day);
    if (existing) existing.push(hour);
    else byDay.set(day, [hour]);
  }
  return DAY_ORDER_ARR.filter((d) => byDay.has(d))
    .map((d) => {
      const hours = (byDay.get(d) ?? []).sort((a, b) => a - b);
      return `${DAY_SHORT[d]} ${toLabel(hours[0])}–${toLabel(hours[hours.length - 1] + 1)}`;
    })
    .join(", ");
};

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
      {title}
    </Typography>
    {subtitle && (
      <Typography variant="body2" color="text.secondary">
        {subtitle}
      </Typography>
    )}
  </Box>
);

const PreferencesForm = ({ onSubmit, loading }: PreferencesFormProps) => {
  const [activities, setActivities] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [slotMap, setSlotMap] = useState<Map<string, SlotState>>(new Map());
  const [facilities, setFacilities] = useState<string[]>([]);
  const [rainFilter, setRainFilter] = useState(false);
  const [facilitiesHardFilter, setFacilitiesHardFilter] = useState(false);
  const preferredSlots = filterSlots(slotMap, "preferred");
  const unavailableSlots = filterSlots(slotMap, "unavailable");

  const prefs: UserPreferences = {
    preferredActivities: activities,
    preferredExerciseCategories: categories,
    preferredDaysHours: slotsToRanges(preferredSlots),
    unavailableDaysHours: slotsToRanges(unavailableSlots),
    preferredFacilities: facilities,
    rainFilter,
    preferredFacilitiesHardFilter: facilitiesHardFilter,
  };

  const isValid = activities.length > 0 || categories.length > 0;

  const preferredSummary = slotsSummary(preferredSlots);
  const unavailableSummary = slotsSummary(unavailableSlots);

  return (
    <Box
      sx={{
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2.5,
        pr: 0.5,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <FitnessCenterIcon sx={{ color: "primary.main" }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Your Preferences
        </Typography>
      </Box>

      <Divider />

      <Box>
        <SectionHeader
          title="What would you like to do?"
          subtitle="Select at least one activity or exercise category."
        />
        <Autocomplete
          multiple
          options={EXERCISE_CATEGORIES}
          value={categories}
          onChange={(_e, v) => setCategories(v)}
          renderInput={(params) => (
            <TextField {...params} label="Exercise Categories" size="small" />
          )}
          sx={{ mb: 1.5 }}
        />
        <Autocomplete
          multiple
          options={ACTIVITIES}
          value={activities}
          onChange={(_e, v) => setActivities(v)}
          renderInput={(params) => (
            <TextField {...params} label="Specific Activities" size="small" />
          )}
        />
      </Box>

      <Divider />

      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            mb: 1.5,
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Your Schedule
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Mark preferred times (purple) and times you can't attend (red).
            </Typography>
          </Box>
          <CalendarImport
            onImport={(slots) => {
              setSlotMap((prev) => {
                const next = new Map(prev);
                for (const slot of slots) next.set(slot, "unavailable");
                return next;
              });
            }}
          />
        </Box>
        <TimeGrid slots={slotMap} onChange={setSlotMap} />

        {(preferredSummary || unavailableSummary) && (
          <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.25 }}>
            {preferredSummary && (
              <Typography variant="caption" color="primary.main">
                Free: {preferredSummary}
              </Typography>
            )}
            {unavailableSummary && (
              <Typography variant="caption" color="error.main">
                Busy: {unavailableSummary}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      <Divider />

      <Box>
        <SectionHeader title="Facility Preferences" />
        <Autocomplete
          multiple
          options={FACILITIES}
          value={facilities}
          onChange={(_e, v) => setFacilities(v)}
          renderInput={(params) => (
            <TextField {...params} label="Preferred Facilities (optional)" size="small" />
          )}
          sx={{ mb: 1.5 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={facilitiesHardFilter}
              onChange={(e) => setFacilitiesHardFilter(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Only show selected facilities</Typography>}
        />
      </Box>

      <Divider />

      <Box>
        <SectionHeader title="Other Options" />
        <Tooltip
          title="Applied by the backend when generating recommendations — has no effect on already-computed results."
          placement="right"
        >
          <FormControlLabel
            control={
              <Switch
                checked={rainFilter}
                onChange={(e) => setRainFilter(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Avoid the gym when it rains
              </Typography>
            }
          />
        </Tooltip>
      </Box>

      <Divider />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => onSubmit(prefs)}
          disabled={!isValid || loading}
          startIcon={
            loading ? <CircularProgress size={18} color="inherit" /> : <FitnessCenterIcon />
          }
          fullWidth
        >
          {loading ? "Finding best times…" : "Get Recommendations"}
        </Button>

        {!isValid && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
            Select at least one activity or exercise category to continue.
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default PreferencesForm;
