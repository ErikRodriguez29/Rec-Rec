import { Fragment, useEffect, useRef, useState } from "react";
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DAY_CONFIGS } from "../../constants";
import type { SlotState } from "../../types";

const PREFERRED_COLOR = "#aa3bff";
const UNAVAILABLE_COLOR = "#ef4444";
const NEUTRAL_BG = "#f3f4f6";
const NEUTRAL_BORDER = "#e5e7eb";

const SLOT_COLOR: Record<SlotState, string> = {
  preferred: PREFERRED_COLOR,
  unavailable: UNAVAILABLE_COLOR,
};

const GRID_HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM–10 PM

const toLabel = (h: number): string => {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
};

export interface TimeGridProps {
  slots: Map<string, SlotState>;
  onChange: (slots: Map<string, SlotState>) => void;
}

const TimeGrid = ({ slots, onChange }: TimeGridProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mode, setMode] = useState<SlotState>("preferred");

  // Capture mode at drag-start so it stays consistent through the whole drag
  const dragRef = useRef({ active: false, removing: false, dragMode: "preferred" as SlotState });
  const pendingRef = useRef(new Map<string, SlotState>());
  const latestRef = useRef(slots);

  useEffect(() => {
    latestRef.current = slots;
  }, [slots]);

  useEffect(() => {
    const stop = () => {
      dragRef.current.active = false;
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const handleMouseDown = (slot: string) => {
    const currentState = latestRef.current.get(slot);
    // Never draw over the opposite state — leave a cell holding the other color untouched.
    if (currentState !== undefined && currentState !== mode) return;
    const removing = currentState === mode;
    dragRef.current = { active: true, removing, dragMode: mode };
    pendingRef.current = new Map(latestRef.current);
    if (removing) {
      pendingRef.current.delete(slot);
    } else {
      pendingRef.current.set(slot, mode);
    }
    onChange(new Map(pendingRef.current));
  };

  const handleMouseEnter = (slot: string) => {
    if (!dragRef.current.active) return;
    const { removing, dragMode } = dragRef.current;
    const currentState = pendingRef.current.get(slot);
    if (removing) {
      // Only erase cells of the color we started erasing.
      if (currentState !== dragMode) return;
      pendingRef.current.delete(slot);
    } else {
      // Only fill empty cells; never overwrite the opposite color.
      if (currentState !== undefined) return;
      pendingRef.current.set(slot, dragMode);
    }
    onChange(new Map(pendingRef.current));
  };

  const getCellSx = (slot: string) => {
    const state = slots.get(slot);
    const fill = state ? SLOT_COLOR[state] : undefined;
    // A cell holding the opposite color can't be drawn on in the current mode.
    const locked = state !== undefined && state !== mode;
    const hoverFill = SLOT_COLOR[mode];
    return {
      bgcolor: fill ?? NEUTRAL_BG,
      border: "1px solid",
      borderColor: fill ?? NEUTRAL_BORDER,
      borderRadius: "3px",
      cursor: locked ? "not-allowed" : "pointer",
      userSelect: "none" as const,
      transition: "background-color 60ms, border-color 60ms",
      "&:hover": locked
        ? { bgcolor: fill }
        : {
            bgcolor: fill ? `${fill}cc` : `${hoverFill}33`,
            borderColor: hoverFill,
          },
    };
  };

  const modeToggle = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_e, v: SlotState | null) => {
          if (v) setMode(v);
        }}
        size="small"
      >
        <ToggleButton
          value="preferred"
          sx={{
            fontSize: 12,
            px: 1.5,
            textTransform: "none",
            "&.Mui-selected": {
              bgcolor: PREFERRED_COLOR,
              color: "white",
              "&:hover": { bgcolor: `${PREFERRED_COLOR}dd` },
            },
          }}
        >
          Preferred
        </ToggleButton>
        <ToggleButton
          value="unavailable"
          sx={{
            fontSize: 12,
            px: 1.5,
            textTransform: "none",
            "&.Mui-selected": {
              bgcolor: UNAVAILABLE_COLOR,
              color: "white",
              "&:hover": { bgcolor: `${UNAVAILABLE_COLOR}dd` },
            },
          }}
        >
          Unavailable
        </ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
          <Box sx={{ width: 10, height: 10, bgcolor: PREFERRED_COLOR, borderRadius: "2px" }} />
          <Typography variant="caption" color="text.secondary">
            Free
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
          <Box sx={{ width: 10, height: 10, bgcolor: UNAVAILABLE_COLOR, borderRadius: "2px" }} />
          <Typography variant="caption" color="text.secondary">
            Busy
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  if (isMobile) {
    // Horizontal layout: days = rows, hours = columns (scrolls right)
    const COL = 28;
    const ROW = 28;
    const LABEL_W = 36;

    return (
      <Box>
        {modeToggle}
        <Box sx={{ overflowX: "auto", overflowY: "hidden", pb: 0.5, mx: -0.5, px: 0.5 }}>
          <Box
            sx={{
              display: "inline-grid",
              gridTemplateColumns: `${LABEL_W}px repeat(${GRID_HOURS.length}, ${COL}px)`,
              gap: "2px",
              userSelect: "none",
            }}
          >
            {/* Hour header row */}
            <Box />
            {GRID_HOURS.map((h, i) => (
              <Box
                key={h}
                sx={{
                  height: 18,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                <Typography sx={{ fontSize: 9, color: "text.secondary", lineHeight: 1 }}>
                  {i % 2 === 0 ? toLabel(h) : ""}
                </Typography>
              </Box>
            ))}

            {/* Day rows */}
            {DAY_CONFIGS.map(({ code, name }) => (
              <Fragment key={code}>
                <Box
                  sx={{
                    height: ROW,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    pr: 0.75,
                  }}
                >
                  <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 500 }}>
                    {name.slice(0, 3)}
                  </Typography>
                </Box>
                {GRID_HOURS.map((h) => {
                  const slot = `${code}-${h}`;
                  return (
                    <Box
                      key={slot}
                      data-slot={slot}
                      sx={{ width: COL, height: ROW, ...getCellSx(slot) }}
                      onMouseDown={() => handleMouseDown(slot)}
                      onMouseEnter={() => handleMouseEnter(slot)}
                    />
                  );
                })}
              </Fragment>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  // Vertical layout (desktop): days = columns, hours = rows
  const COL = 34;
  const ROW = 22;
  const LABEL_W = 38;

  return (
    <Box>
      {modeToggle}
      <Box
        sx={{
          display: "inline-grid",
          gridTemplateColumns: `${LABEL_W}px repeat(${DAY_CONFIGS.length}, ${COL}px)`,
          gap: "2px",
          userSelect: "none",
        }}
      >
        {/* Day header row */}
        <Box />
        {DAY_CONFIGS.map(({ code, name }) => (
          <Box
            key={code}
            sx={{ height: 20, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          >
            <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
              {name.slice(0, 3)}
            </Typography>
          </Box>
        ))}

        {/* Hour rows */}
        {GRID_HOURS.map((h, hIdx) => (
          <Fragment key={h}>
            <Box
              sx={{
                height: ROW,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                pr: 0.75,
              }}
            >
              <Typography sx={{ fontSize: 10, color: "text.secondary", lineHeight: 1 }}>
                {hIdx % 2 === 0 ? toLabel(h) : ""}
              </Typography>
            </Box>
            {DAY_CONFIGS.map(({ code }) => {
              const slot = `${code}-${h}`;
              return (
                <Box
                  key={slot}
                  data-slot={slot}
                  sx={{ width: COL, height: ROW, ...getCellSx(slot) }}
                  onMouseDown={() => handleMouseDown(slot)}
                  onMouseEnter={() => handleMouseEnter(slot)}
                />
              );
            })}
          </Fragment>
        ))}
      </Box>
    </Box>
  );
};

export default TimeGrid;
