import { useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import PreferencesForm from "./panels/PreferencesForm";
import RecommendationsPanel from "./panels/RecommendationsPanel";
import { getRecommendations, RecommendationsFailedError } from "../utils/getRecommendations";
import { adaptRecommendations } from "../utils/recommendationsAdapter";
import {
  GENERIC_RECOMMENDATION_FAILURE,
  recommendationFailureFromCode,
} from "../utils/recommendationErrors";
import type { RecommendationFailure, RecommendationResult, UserPreferences } from "../types";

const TwoPanelLayout = () => {
  const [recommendations, setRecommendations] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState<RecommendationFailure | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (prefs: UserPreferences) => {
    setLoading(true);
    setRecommendations(null);
    setError(null);
    try {
      // The recommender applies the facility / unavailable / rain filters server-side and returns
      // either a schedule or a structured error, so we render its output directly.
      const raw = await getRecommendations(prefs);
      setRecommendations(adaptRecommendations(raw));
    } catch (e) {
      setError(
        e instanceof RecommendationsFailedError
          ? recommendationFailureFromCode(e.code, e.message)
          : GENERIC_RECOMMENDATION_FAILURE,
      );
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
          <RecommendationsPanel result={recommendations} error={error} />
        </Paper>
      </Box>
    </Box>
  );
};

export default TwoPanelLayout;
