import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ViewListIcon from "@mui/icons-material/ViewList";
import CalendarViewWeekIcon from "@mui/icons-material/CalendarViewWeek";
import { CATEGORY_COLORS, DAY_COLORS, DAY_ORDER } from "../../constants";
import type { OverallRec, RecommendationFailure, RecommendationResult, WeekRecs } from "../../types";
import WeekCalendarView from "../components/WeekCalendarView";

const getCategoryColor = (key: string) => CATEGORY_COLORS[key.toLowerCase()] ?? "#aa3bff";

const ScoreChip = ({ score }: { score: number }) => (
  <Chip
    label={`★ ${score}`}
    size="small"
    variant="outlined"
    sx={{ fontSize: 11, height: 20, "& .MuiChip-label": { px: 0.75 } }}
  />
);

const OverallSection = ({ overall }: { overall: OverallRec[] }) => {
  const activeDays = DAY_ORDER.filter((d) => overall.some((r) => r.day === d));

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mt: 1, fontWeight: 700 }}>
        Overall Recommendations
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {activeDays.map((day) => {
          const recs = overall.filter((r) => r.day === day);
          const dayColor = DAY_COLORS[day] ?? "#aa3bff";
          return (
            <Card
              key={day}
              variant="outlined"
              sx={{ borderLeft: `4px solid ${dayColor}`, borderRadius: 2 }}
            >
              <CardContent sx={{ py: 1.25, px: 2, "&:last-child": { pb: 1.25 } }}>
                <Typography variant="subtitle2" sx={{ color: dayColor, mb: 0.5, fontWeight: 700 }}>
                  {day}
                </Typography>
                {recs.map((rec, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      flexWrap: "wrap",
                      mt: i > 0 ? 0.5 : 0,
                    }}
                  >
                    <Chip
                      label={rec.category}
                      size="small"
                      sx={{
                        bgcolor: getCategoryColor(rec.category),
                        color: "white",
                        fontWeight: 600,
                        fontSize: 11,
                        height: 20,
                        "& .MuiChip-label": { px: 0.75 },
                        textTransform: "capitalize",
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {rec.facility}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                      <AccessTimeIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                      <Typography variant="body2" color="text.secondary">
                        {rec.time}
                      </Typography>
                    </Box>
                    <ScoreChip score={rec.score} />
                  </Box>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};

const WeekView = ({ recs }: { recs: WeekRecs }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
    <OverallSection overall={recs.overall} />
    {recs.categories.map((cat) => (
      <Accordion
        key={cat.category}
        elevation={0}
        variant="outlined"
        sx={{ borderRadius: "12px !important" }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: getCategoryColor(cat.category),
                flexShrink: 0,
              }}
            />
            <Typography sx={{ fontWeight: 600, textTransform: "capitalize" }}>
              {cat.category}
            </Typography>
            <Chip
              label={`${cat.days.length} days`}
              size="small"
              sx={{ fontSize: 11, height: 18, "& .MuiChip-label": { px: 0.75 } }}
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {[...cat.days]
              .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
              .map((dayRec, dayIdx, arr) => (
                <Box key={dayRec.day}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: DAY_COLORS[dayRec.day] ?? "#aa3bff",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontWeight: 700,
                    }}
                  >
                    {dayRec.day}
                  </Typography>
                  {dayRec.facilities.map((fac, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        pl: 1.5,
                        mt: 0.5,
                        flexWrap: "wrap",
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {fac.facility}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <AccessTimeIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                        <Typography variant="body2" color="text.secondary">
                          {fac.times.join(" or ")}
                        </Typography>
                      </Box>
                      <ScoreChip score={fac.score} />
                    </Box>
                  ))}
                  {dayIdx < arr.length - 1 && <Divider sx={{ mt: 1 }} />}
                </Box>
              ))}
          </Box>
        </AccordionDetails>
      </Accordion>
    ))}
  </Box>
);

const EmptyState = () => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      gap: 2,
      userSelect: "none",
    }}
  >
    <FitnessCenterIcon sx={{ fontSize: 56, color: "primary.main", opacity: 0.2 }} />
    <Box sx={{ textAlign: "center" }}>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No recommendations yet
      </Typography>
      <Typography variant="body2" color="text.disabled">
        Fill in your preferences and click
        <br />
        <strong>"Get Recommendations"</strong> to see results.
      </Typography>
    </Box>
  </Box>
);

const ErrorState = ({ failure }: { failure: RecommendationFailure }) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      px: 2,
    }}
  >
    <Alert severity="warning" sx={{ maxWidth: 460 }}>
      <AlertTitle sx={{ fontWeight: 700 }}>No recommendations found</AlertTitle>
      {failure.userMessage}
    </Alert>
  </Box>
);

interface RecommendationsPanelProps {
  result: RecommendationResult | null;
  error?: RecommendationFailure | null;
}

const RecommendationsPanel = ({ result, error }: RecommendationsPanelProps) => {
  const [tab, setTab] = useState(0);
  const [calView, setCalView] = useState(true);

  const weekOffset = tab === 0 ? 0 : 1;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexShrink: 0 }}>
        <EventAvailableIcon sx={{ color: "primary.main" }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Recommendations
        </Typography>
        {result && (
          <>
            <Chip label="Ready" size="small" color="success" sx={{ fontWeight: 600 }} />
            <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
              <Tooltip title="List view">
                <IconButton
                  size="small"
                  onClick={() => setCalView(false)}
                  color={calView ? "default" : "primary"}
                >
                  <ViewListIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Calendar view">
                <IconButton
                  size="small"
                  onClick={() => setCalView(true)}
                  color={calView ? "primary" : "default"}
                >
                  <CalendarViewWeekIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </>
        )}
      </Box>

      {error ? (
        <ErrorState failure={error} />
      ) : result === null ? (
        <EmptyState />
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={(_e, v: number) => setTab(v)}
            sx={{ mb: 2, flexShrink: 0, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="Current Week" />
            <Tab label="Next Week" />
          </Tabs>
          <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {calView ? (
              <WeekCalendarView
                recs={tab === 0 ? result.currentWeek : result.nextWeek}
                weekOffset={weekOffset as 0 | 1}
              />
            ) : (
              <Box sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
                {tab === 0 && <WeekView recs={result.currentWeek} />}
                {tab === 1 && <WeekView recs={result.nextWeek} />}
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export default RecommendationsPanel;
