import {
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
import type {
  CategoryRecommendations,
  RecommendationsPayload,
  WeekRecommendations,
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

function OverallTable({ overall }: { overall: WeekRecommendations["overall"] }) {
  const sorted = useMemo(() => {
    const rank = new Map(DAY_ORDER.map((d, i) => [d, i]));
    return [...overall].sort(
      (a, b) =>
        (rank.get(a.day as (typeof DAY_ORDER)[number]) ?? 99) -
        (rank.get(b.day as (typeof DAY_ORDER)[number]) ?? 99),
    );
  }, [overall]);

  return (
    <TableContainer>
      <Table size="small" aria-label="Overall weekly recommendations">
        <TableHead>
          <TableRow>
            <TableCell>Day</TableCell>
            <TableCell>Activity / category</TableCell>
            <TableCell>Facility</TableCell>
            <TableCell>Time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.day}>
              <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{row.day}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
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
            </TableRow>
          ))}
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
                <Box component="span" sx={{ color: "text.disabled", ml: 1 }}>
                  (score {opt.score})
                </Box>
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
        One suggested visit per day across your activities and categories.
      </Typography>
      <OverallTable overall={week.overall} />

      {categories.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            By activity or category
          </Typography>
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
        </Box>
      )}
    </Paper>
  );
}

type RecommendationsDisplayProps = {
  data: RecommendationsPayload;
  sourceNote?: string;
};

export default function RecommendationsDisplay({ data, sourceNote }: RecommendationsDisplayProps) {
  return (
    <Stack spacing={2}>
      {sourceNote !== undefined && sourceNote.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          {sourceNote}
        </Typography>
      )}
      <WeekPanel
        title="This week"
        week={data.current_week}
        categorySelectId="current-week-category"
      />
      <WeekPanel title="Next week" week={data.next_week} categorySelectId="next-week-category" />
    </Stack>
  );
}
