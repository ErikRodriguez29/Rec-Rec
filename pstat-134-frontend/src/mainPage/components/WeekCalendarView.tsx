import { Box, Button, Tooltip, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { CATEGORY_COLORS, DAY_ORDER } from "../../constants";
import { getWeekMonday, parseAmPmHour } from "../../utils/icsParser";
import { downloadICS } from "../../utils/icsExport";
import type { OverallRec, WeekRecs } from "../../types";

const ROW_H = 30; // px per hour
const COL_W = 110; // px per day column
const LABEL_W = 44; // px for time labels
const HEADER_H = 48;

const toLabel = (h: number): string => {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
};

const getCatColor = (cat: string) => CATEGORY_COLORS[cat.toLowerCase()] ?? "#aa3bff";

interface WeekCalendarViewProps {
  recs: WeekRecs;
  weekOffset: 0 | 1;
}

const WeekCalendarView = ({ recs, weekOffset }: WeekCalendarViewProps) => {
  const weekMonday = getWeekMonday(weekOffset);

  const dayDates = DAY_ORDER.map((_, i) => {
    const d = new Date(weekMonday);
    d.setDate(weekMonday.getDate() + i);
    return d;
  });

  const recsByDay = new Map<string, OverallRec[]>();
  for (const rec of recs.overall) {
    const existing = recsByDay.get(rec.day) ?? [];
    recsByDay.set(rec.day, [...existing, rec]);
  }

  // Crop the visible hour range to just what the events need
  const eventHours = recs.overall.map((r) => parseAmPmHour(r.time));
  const firstHour = eventHours.length > 0 ? Math.max(5, Math.min(...eventHours) - 1) : 6;
  const lastHour = eventHours.length > 0 ? Math.min(23, Math.max(...eventHours) + 2) : 22;
  const HOURS = Array.from({ length: lastHour - firstHour }, (_, i) => i + firstHour);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%" }}>
      {/* Action bar */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => downloadICS(recs.overall, weekOffset)}
          sx={{ textTransform: "none" }}
        >
          Download .ics
        </Button>
      </Box>

      {/* Calendar grid */}
      <Box sx={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
        <Box sx={{ display: "flex", minWidth: LABEL_W + COL_W * 7 }}>
          {/* Time label column */}
          <Box sx={{ width: LABEL_W, flexShrink: 0 }}>
            <Box sx={{ height: HEADER_H, borderBottom: "2px solid", borderColor: "divider" }} />
            {HOURS.map((h) => (
              <Box
                key={h}
                sx={{
                  height: ROW_H,
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "flex-start",
                  pt: 0.25,
                  pr: 1,
                }}
              >
                <Typography sx={{ fontSize: 9, color: "text.secondary", lineHeight: 1 }}>
                  {toLabel(h)}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Day columns */}
          {DAY_ORDER.map((day, dayIdx) => {
            const date = dayDates[dayIdx];
            const isToday = date.toDateString() === new Date().toDateString();
            const dayRecs = recsByDay.get(day) ?? [];

            const byHour = new Map<number, OverallRec[]>();
            for (const rec of dayRecs) {
              const h = parseAmPmHour(rec.time);
              const existing = byHour.get(h) ?? [];
              byHour.set(h, [...existing, rec]);
            }

            return (
              <Box
                key={day}
                sx={{
                  width: COL_W,
                  flexShrink: 0,
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  position: "relative",
                }}
              >
                {/* Day header */}
                <Box
                  sx={{
                    height: HEADER_H,
                    textAlign: "center",
                    borderBottom: "2px solid",
                    borderColor: "divider",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.25,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: "text.secondary",
                      fontWeight: 600,
                      letterSpacing: 0.5,
                    }}
                  >
                    {day.slice(0, 3).toUpperCase()}
                  </Typography>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      bgcolor: isToday ? "primary.main" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: isToday ? 700 : 400,
                        color: isToday ? "white" : "text.primary",
                      }}
                    >
                      {date.getDate()}
                    </Typography>
                  </Box>
                </Box>

                {/* Hour rows (background grid) */}
                {HOURS.map((h) => (
                  <Box
                    key={h}
                    sx={{ height: ROW_H, borderBottom: "1px solid", borderColor: "grey.100" }}
                  />
                ))}

                {/* Event blocks */}
                {[...byHour.entries()].map(([hour, hourRecs]) =>
                  hourRecs.map((rec, i) => {
                    const color = getCatColor(rec.category);
                    const total = hourRecs.length;
                    const w = Math.floor((COL_W - 4) / total);
                    const left = 2 + i * w;
                    const top = HEADER_H + (hour - firstHour) * ROW_H + 1;

                    return (
                      <Tooltip
                        key={`${rec.category}-${i}`}
                        title={`${rec.facility} · ${rec.category} · Score ${rec.score}`}
                        placement="top"
                      >
                        <Box
                          sx={{
                            position: "absolute",
                            top,
                            left,
                            width: w - 2,
                            height: ROW_H - 2,
                            bgcolor: color,
                            borderRadius: 1,
                            p: "2px 4px",
                            overflow: "hidden",
                            cursor: "default",
                            boxShadow: 1,
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 9,
                              color: "white",
                              fontWeight: 700,
                              lineHeight: 1.2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {rec.facility.split(" ").slice(0, 3).join(" ")}
                          </Typography>
                          <Typography
                            sx={{ fontSize: 8, color: "rgba(255,255,255,0.85)", lineHeight: 1.2 }}
                          >
                            {rec.time}
                          </Typography>
                        </Box>
                      </Tooltip>
                    );
                  }),
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default WeekCalendarView;
