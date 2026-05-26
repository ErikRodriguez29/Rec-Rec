import { Box, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { getForecastHeatmapWeekNumbers } from "../predictionWeeks";

function HeatmapPanel({ week, title }: { week: number; title: string }) {
  const [unavailable, setUnavailable] = useState(false);
  const src = `/api/predictions/heatmap/${week}`;

  return (
    <Box sx={{ width: "100%" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      {unavailable ? (
        <Typography variant="body2" color="text.secondary">
          No heatmap available for week {week}
        </Typography>
      ) : (
        <Box
          component="img"
          src={src}
          alt={`Facility occupancy forecast heatmap for week ${week}`}
          onError={() => setUnavailable(true)}
          sx={{
            width: "100%",
            height: "auto",
            display: "block",
            borderRadius: 1,
            border: 1,
            borderColor: "divider",
          }}
        />
      )}
    </Box>
  );
}

export default function PredictionHeatmaps() {
  const weeks = getForecastHeatmapWeekNumbers();

  return (
    <Paper elevation={0} variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Prediction heatmaps
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Forecasted occupancy across all facilities for the current and upcoming weeks.
          </Typography>
        </Box>
        <Stack spacing={3} sx={{ width: "100%" }}>
          <HeatmapPanel week={weeks.currentWeek} title="This week" />
          <HeatmapPanel week={weeks.nextWeek} title="Next week" />
        </Stack>
      </Stack>
    </Paper>
  );
}
