import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { useMemo, useState } from "react";
import {
  getOverallAlternateOption,
  type CategoryRecommendations,
  type RecommendationsPayload,
  type WeekRecommendations,
} from "./recommendationsTypes";

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function typeLabel(type: "activity" | "exercise_category") {
  return type === "exercise_category" ? "Category" : "Activity";
}

function formatAlternateTime(
  row: WeekRecommendations["overall"][number],
  alternate: NonNullable<ReturnType<typeof getOverallAlternateOption>>,
) {
  if (alternate.facility_name === row.facility_name) {
    return alternate.time_of_day;
  }
  return `${alternate.time_of_day} — ${alternate.facility_name}`;
}

function OverallTable({ week }: { week: WeekRecommendations }) {
  const sorted = useMemo(() => {
    const rank = new Map(DAY_ORDER.map((d, i) => [d, i]));
    return [...week.overall].sort(
      (a, b) =>
        (rank.get(a.day as (typeof DAY_ORDER)[number]) ?? 99) -
        (rank.get(b.day as (typeof DAY_ORDER)[number]) ?? 99),
    );
  }, [week.overall]);

  return (
    <TableContainer>
      <Table size="small" aria-label="Overall weekly recommendations">
        <TableHead>
          <TableRow>
            <TableCell>Day</TableCell>
            <TableCell>Activity / category</TableCell>
            <TableCell>Facility</TableCell>
            <TableCell>Best time</TableCell>
            <TableCell>Alternative time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((row) => {
            const alternate = getOverallAlternateOption(week, row);
            return (
              <TableRow key={row.day}>
                <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{row.day}</TableCell>
                <TableCell>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <span>{row.activity_or_category}</span>
                    <Chip
                      size="small"
                      label={typeLabel(row.type)}
                      variant="outlined"
                      sx={{ height: 22 }}
                    />
                  </Stack>
                </TableCell>
                <TableCell>{row.facility_name}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{row.time_of_day}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {alternate !== null ? (
                    formatAlternateTime(row, alternate)
                  ) : (
                    <Box component="span" sx={{ color: "text.disabled" }}>
                      —
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CategoryDetail({ category }: { category: CategoryRecommendations }) {
  const sortedDays = useMemo(() => {
    const rank = new Map(DAY_ORDER.map((d, i) => [d, i]));
    return [...category.schedule].sort(
      (a, b) =>
        (rank.get(a.day as (typeof DAY_ORDER)[number]) ?? 99) -
        (rank.get(b.day as (typeof DAY_ORDER)[number]) ?? 99),
    );
  }, [category.schedule]);

  return (
    <Stack spacing={1.5}>
      {sortedDays.map((dayBlock) => (
        <Box key={dayBlock.day}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {dayBlock.day}
          </Typography>
          <Stack spacing={0.75} sx={{ pl: 1 }}>
            {dayBlock.options.map((opt, idx) => (
              <Typography key={`${dayBlock.day}-${idx}`} variant="body2" color="text.secondary">
                {opt.time_of_day} — {opt.facility_name}
              </Typography>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function WeekPanel({
  title,
  week,
  categorySelectId,
}: {
  title: string;
  week: WeekRecommendations;
  categorySelectId: string;
}) {
  const categories = week.by_category;
  const [selectedId, setSelectedId] = useState(() => categories[0]?.id ?? "");
  const effectiveId = selectedId || categories[0]?.id || "";
  const selected = categories.find((c) => c.id === effectiveId) ?? null;

  const handleCategoryChange = (e: SelectChangeEvent<string>) => {
    setSelectedId(e.target.value);
  };

  return (
    <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 700 }}>
        {title}
      </Typography>

      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Overall plan
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        One suggested visit per day across your activities and categories, with a second-choice time
        when available.
      </Typography>
      <OverallTable week={week} />

      {categories.length > 0 && (
        <Accordion
          defaultExpanded={false}
          disableGutters
          elevation={0}
          sx={{
            mt: 3,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary
            aria-controls={`${categorySelectId}-content`}
            id={`${categorySelectId}-header`}
            sx={{ px: 1.5 }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                By activity or category
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Expand to compare all time options for a specific activity or workout focus.
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 2 }}>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel id={categorySelectId}>Activity or category</InputLabel>
              <Select<string>
                labelId={categorySelectId}
                label="Activity or category"
                value={effectiveId}
                onChange={handleCategoryChange}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.label} ({typeLabel(cat.type)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selected !== null && <CategoryDetail category={selected} />}
          </AccordionDetails>
        </Accordion>
      )}
    </Paper>
  );
}

type RecommendationsDisplayProps = {
  data: RecommendationsPayload;
};

export default function RecommendationsDisplay({ data }: RecommendationsDisplayProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Based on your preferences and forecasted facility use. Times favor lower crowding and match
        your preferred schedule when possible.
      </Typography>
      <WeekPanel
        title="This week"
        week={data.current_week}
        categorySelectId="current-week-category"
      />
      <WeekPanel title="Next week" week={data.next_week} categorySelectId="next-week-category" />
    </Stack>
  );
}
