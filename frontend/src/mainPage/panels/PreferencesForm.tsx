import { useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { ACTIVITIES, DAY_CONFIGS, EXERCISE_CATEGORIES, FACILITIES } from "../../constants";
import type { DayCode, DayHourEntry, SlotState, UserPreferences } from "../../types";
import { fetchGoogleBusySlots, requestGoogleCalendarToken } from "../../api/googleCalendar";
import TimeGrid from "../components/TimeGrid";
import "./PreferencesForm.css";

interface PreferencesFormProps {
  loading: boolean;
  onSubmit: (prefs: UserPreferences) => void;
}

const dayOrder = DAY_CONFIGS.map((config) => config.code);

const dayShort = Object.fromEntries(DAY_CONFIGS.map(({ code, name }) => [code, name.slice(0, 3)]));

function toLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

function filterSlots(slotMap: Map<string, SlotState>, state: SlotState): Set<string> {
  return new Set([...slotMap.entries()].filter(([, value]) => value === state).map(([key]) => key));
}

function slotsToRanges(slots: Set<string>): DayHourEntry[] {
  const byDay = new Map<string, number[]>();

  for (const slot of slots) {
    const day = slot[0];
    const hour = Number(slot.slice(2));
    byDay.set(day, [...(byDay.get(day) ?? []), hour]);
  }

  return dayOrder
    .filter((day) => byDay.has(day))
    .map((day) => {
      const hours = (byDay.get(day) ?? []).sort((a, b) => a - b);

      return {
        day: day as DayCode,
        startHour: hours[0],
        endHour: hours[hours.length - 1],
      };
    });
}

function slotsSummary(slots: Set<string>): string {
  return slotsToRanges(slots)
    .map(
      ({ day, startHour, endHour }) =>
        `${dayShort[day]} ${toLabel(startHour)}-${toLabel(endHour + 1)}`,
    )
    .join(", ");
}

const PreferencesForm = ({ loading, onSubmit }: PreferencesFormProps) => {
  const [activities, setActivities] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [slotMap, setSlotMap] = useState<Map<string, SlotState>>(new Map());
  const [rainFilter, setRainFilter] = useState(false);
  const [facilitiesHardFilter, setFacilitiesHardFilter] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarLinked, setCalendarLinked] = useState(false);
  const [calendarError, setCalendarError] = useState("");

  const preferredSlots = filterSlots(slotMap, "preferred");
  const manualUnavailableSlots = filterSlots(slotMap, "unavailable");
  const googleBusySlots = filterSlots(slotMap, "googleBusy");

  const unavailableSlots = new Set([...manualUnavailableSlots, ...googleBusySlots]);

  const isValid = activities.length > 0 || categories.length > 0;

  const prefs: UserPreferences = {
    preferredActivities: activities,
    preferredExerciseCategories: categories,
    preferredDaysHours: slotsToRanges(preferredSlots),
    unavailableDaysHours: slotsToRanges(unavailableSlots),
    preferredFacilities: facilities,
    rainFilter,
    preferredFacilitiesHardFilter: facilitiesHardFilter,
  };

  const handleLinkGoogleCalendar = async () => {
    if (calendarLoading) return;

    setCalendarLoading(true);
    setCalendarError("");

    try {
      const token = await requestGoogleCalendarToken();
      const busySlots = await fetchGoogleBusySlots(token);

      setSlotMap((current) => {
        const next = new Map(current);

        for (const slot of busySlots) {
          const key = `${slot.day}-${slot.hour}`;

          if (!next.has(key)) {
            next.set(key, "googleBusy");
          }
        }

        return next;
      });

      setCalendarLinked(true);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "Could not link Google Calendar.");
    } finally {
      setCalendarLoading(false);
    }
  };

  const clearGoogleCalendarSlots = () => {
    setSlotMap((current) => {
      const next = new Map(current);

      for (const [key, value] of next.entries()) {
        if (value === "googleBusy") {
          next.delete(key);
        }
      }

      return next;
    });

    setCalendarLinked(false);
    setCalendarError("");
  };

  return (
    <form
      className="preferences-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (isValid && !loading) onSubmit(prefs);
      }}
    >
      <div className="section-title">
        <h2>Your Preferences</h2>
      </div>

      <fieldset>
        <legend>Workout</legend>

        <Autocomplete
          multiple
          options={EXERCISE_CATEGORIES}
          value={categories}
          className="preference-autocomplete"
          onChange={(_, value) => setCategories(value)}
          renderInput={(params) => <TextField {...params} label="Exercise categories" />}
        />

        <Autocomplete
          multiple
          options={ACTIVITIES}
          value={activities}
          className="preference-autocomplete"
          onChange={(_, value) => setActivities(value)}
          renderInput={(params) => <TextField {...params} label="Specific activities" />}
        />
      </fieldset>

      <fieldset>
        <legend>Schedule</legend>

        <div className="calendar-link-row">
          <button
            className="calendar-link-button"
            type="button"
            disabled={calendarLoading}
            onClick={handleLinkGoogleCalendar}
          >
            {calendarLoading
              ? "Reading Google Calendar..."
              : calendarLinked
                ? "Refresh Google Calendar"
                : "Link Google Calendar"}
          </button>

          {calendarLinked && (
            <button
              className="calendar-clear-button"
              type="button"
              onClick={clearGoogleCalendarSlots}
            >
              Clear Google busy times
            </button>
          )}
        </div>

        {calendarLinked && (
          <p className="calendar-link-status">
            Google Calendar busy times were added in purple. Click a purple slot to remove it.
          </p>
        )}

        {calendarError && <p className="calendar-link-error">{calendarError}</p>}

        <TimeGrid onChange={setSlotMap} slots={slotMap} />

        <div className="slot-summary">
          {preferredSlots.size > 0 && <p>Free: {slotsSummary(preferredSlots)}</p>}
          {manualUnavailableSlots.size > 0 && <p>Busy: {slotsSummary(manualUnavailableSlots)}</p>}
          {googleBusySlots.size > 0 && <p>Google busy: {slotsSummary(googleBusySlots)}</p>}
        </div>
      </fieldset>

      <fieldset>
        <legend>Facilities</legend>

        <Autocomplete
          multiple
          options={FACILITIES}
          value={facilities}
          className="preference-autocomplete"
          onChange={(_, value) => setFacilities(value)}
          renderInput={(params) => <TextField {...params} label="Preferred facilities" />}
        />

        <label className="checkbox-row">
          <input
            checked={facilitiesHardFilter}
            type="checkbox"
            onChange={(event) => setFacilitiesHardFilter(event.currentTarget.checked)}
          />
          Only show selected facilities
        </label>
      </fieldset>

      <fieldset>
        <legend>Options</legend>

        <label className="checkbox-row">
          <input
            checked={rainFilter}
            type="checkbox"
            onChange={(event) => setRainFilter(event.currentTarget.checked)}
          />
          Avoid the gym when it rains
        </label>
      </fieldset>

      <button className="primary-button" disabled={!isValid || loading} type="submit">
        {loading ? "Finding best times..." : "Get recommendations"}
      </button>

      {!isValid && <p className="form-hint">Select an activity or category to continue.</p>}
    </form>
  );
};

export default PreferencesForm;
