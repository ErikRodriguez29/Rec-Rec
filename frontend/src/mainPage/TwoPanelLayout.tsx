import { useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import PreferencesForm from "./panels/PreferencesForm";
import RecommendationsPanel from "./panels/RecommendationsPanel";
import { mockRecommendations } from "../data/mockRecommendations";
import { adaptRecommendations } from "../utils/recommendationsAdapter";
import { DAY_CONFIGS } from "../constants";
import { parseAmPmHour } from "../utils/icsParser";
import type { RecommendationResult, UserPreferences, WeekRecs } from "../types";

// Map day codes ("M", "T"…) to full names ("Monday", "Tuesday"…)
const DAY_CODE_TO_NAME = Object.fromEntries(DAY_CONFIGS.map(({ code, name }) => [code, name]));

function applyFilters(result: RecommendationResult, prefs: UserPreferences): RecommendationResult {
  const allowedFacilities =
    prefs.preferredFacilitiesHardFilter && prefs.preferredFacilities.length > 0
      ? new Set(prefs.preferredFacilities)
      : null;

  // Returns true if this day+time falls inside any unavailable block
  const isUnavailable = (day: string, time: string): boolean =>
    prefs.unavailableDaysHours.some((entry) => {
      const hour = parseAmPmHour(time);
      return (
        DAY_CODE_TO_NAME[entry.day] === day && hour >= entry.startHour && hour <= entry.endHour
      );
    });

  const filterWeek = (week: WeekRecs): WeekRecs => ({
    overall: week.overall.filter(
      (r) =>
        (!allowedFacilities || allowedFacilities.has(r.facility)) && !isUnavailable(r.day, r.time),
    ),
    categories: week.categories
      .map((cat) => ({
        ...cat,
        days: cat.days
          .map((d) => ({
            ...d,
            facilities: d.facilities
              .map((f) => ({
                ...f,
                times: f.times.filter((t) => !isUnavailable(d.day, t)),
              }))
              .filter(
                (f) =>
                  f.times.length > 0 && (!allowedFacilities || allowedFacilities.has(f.facility)),
              ),
          }))
          .filter((d) => d.facilities.length > 0),
      }))
      .filter((cat) => cat.days.length > 0),
  });

  return { currentWeek: filterWeek(result.currentWeek), nextWeek: filterWeek(result.nextWeek) };
}

const TwoPanelLayout = () => {
  const [recommendations, setRecommendations] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (prefs: UserPreferences) => {
    setLoading(true);
    setRecommendations(null);
    try {
      const res = await fetch("/recommendations.json");
      const raw = await res.json();
      setRecommendations(applyFilters(adaptRecommendations(raw), prefs));
    } catch {
      setRecommendations(applyFilters(mockRecommendations, prefs));
    } finally {
      setLoading(false);
    }
  };

  const panelSx = {
    border: "1px solid",
    borderColor: "divider",
    p: 3,
    borderRadius: 3,
  } as const;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: { md: "100vh" },
        minHeight: { xs: "100vh" },
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ px: { xs: 1.5, md: 3 }, pt: { xs: 1.5, md: 2.5 }, pb: 1 }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 800, color: "primary.main", letterSpacing: -0.5 }}
        >
          Rec-Rec
        </Typography>
        <Typography variant="caption" color="text.secondary">
          UCSB Recreation Center · Smart Workout Planner
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          flex: 1,
          px: { xs: 1.5, md: 3 },
          pb: { xs: 1.5, md: 3 },
          gap: { xs: 2, md: 3 },
          boxSizing: "border-box",
          overflow: { md: "hidden" },
          minHeight: 0,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            ...panelSx,
            width: { xs: "100%", md: 420 },
            flexShrink: 0,
            height: { md: "100%" },
            minHeight: { md: 0 },
            overflow: { md: "hidden" },
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          <PreferencesForm onSubmit={handleSubmit} loading={loading} />
        </Paper>

        <Paper
          elevation={0}
          sx={{
            ...panelSx,
            flex: 1,
            height: { md: "100%" },
            minHeight: { xs: 480, md: 0 },
            overflow: { md: "hidden" },
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          <RecommendationsPanel result={recommendations} />
        </Paper>
      </Box>
    </Box>
  );
};

export default TwoPanelLayout;
