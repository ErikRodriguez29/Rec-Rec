import { Box, Typography, alpha } from "@mui/material";
import { useCallback } from "react";
import { FACILITY_MAP_HOTSPOTS, REC_CENTER_MAP_LABELS } from "./facilityMapHotspots";
import {
  formatAvailableActivities,
  getActivitiesForLocation,
  type FacilityLocation,
} from "./facilityLocations";

/** High contrast on the map’s blue buildings and light-blue pool areas. */
const MARKER_FILL = "#ffffff";
const MARKER_BORDER = "#1e3a5f";
const MARKER_TEXT = "#1e3a5f";
const MARKER_FILL_SELECTED = "#e65100";
const MARKER_BORDER_SELECTED = "#bf360c";
const MARKER_TEXT_SELECTED = "#ffffff";

type FacilitiesMapProps = {
  selectedMapNumber: number | null;
  onSelectMapNumber: (mapNumber: number | null) => void;
};

export function FacilitiesMap({ selectedMapNumber, onSelectMapNumber }: FacilitiesMapProps) {
  const toggleMarker = useCallback(
    (number: number) => {
      onSelectMapNumber(selectedMapNumber === number ? null : number);
    },
    [onSelectMapNumber, selectedMapNumber],
  );

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        lineHeight: 0,
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      <Box
        component="img"
        src="/facilities-map.png"
        alt="UCSB Recreation Center facilities map with numbered locations"
        sx={{
          width: "100%",
          height: "auto",
          display: "block",
        }}
      />
      {FACILITY_MAP_HOTSPOTS.map((hotspot) => {
        const selected = selectedMapNumber === hotspot.number;
        return (
          <Box
            key={hotspot.number}
            component="button"
            type="button"
            aria-label={`Location ${hotspot.number}: ${REC_CENTER_MAP_LABELS[hotspot.number] ?? "facility"}`}
            aria-pressed={selected}
            onClick={() => toggleMarker(hotspot.number)}
            sx={{
              position: "absolute",
              left: `${hotspot.cx}%`,
              top: `${hotspot.cy}%`,
              transform: "translate(-50%, -50%)",
              width: `${hotspot.r * 2}%`,
              minWidth: 28,
              maxWidth: 44,
              aspectRatio: "1",
              p: 0,
              border: "2px solid",
              borderColor: selected ? MARKER_BORDER_SELECTED : MARKER_BORDER,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: selected ? MARKER_FILL_SELECTED : MARKER_FILL,
              color: selected ? MARKER_TEXT_SELECTED : MARKER_TEXT,
              fontSize: "0.7rem",
              fontWeight: 700,
              lineHeight: 1,
              boxShadow: selected
                ? `0 0 0 3px ${alpha("#e65100", 0.35)}, 0 2px 6px rgba(0,0,0,0.45)`
                : "0 2px 6px rgba(0,0,0,0.4)",
              transition:
                "background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s",
              "&:hover": {
                bgcolor: selected ? MARKER_FILL_SELECTED : "#fff8e1",
                borderColor: selected ? MARKER_BORDER_SELECTED : "#e65100",
                color: selected ? MARKER_TEXT_SELECTED : MARKER_TEXT,
                boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
              },
              "&:focus-visible": {
                outline: 2,
                outlineColor: "primary.main",
                outlineOffset: 2,
              },
            }}
          >
            {hotspot.number}
          </Box>
        );
      })}
    </Box>
  );
}

type MapSelectionDetailsProps = {
  mapNumber: number;
  locations: FacilityLocation[];
};

export function MapSelectionDetails({ mapNumber, locations }: MapSelectionDetailsProps) {
  const legendLabel = REC_CENTER_MAP_LABELS[mapNumber];

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? alpha(theme.palette.info.dark, 0.2) : "#e3f2fd",
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Location #{mapNumber}
        {legendLabel !== undefined ? `: ${legendLabel}` : ""}
      </Typography>
      {locations.length > 0 ? (
        <Box component="ul" sx={{ m: "8px 0 0", pl: 2.5 }}>
          {locations.map((entry) => {
            const activities = getActivitiesForLocation(entry);
            return (
              <Box component="li" key={entry.facilities} sx={{ mb: 0.5 }}>
                <Typography variant="body2">
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {entry.facilities}
                  </Box>
                  {entry.note !== undefined ? ` (${entry.note})` : ""}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Facilities in this location: {entry.optionNames.join(", ")}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Available activities: {formatAvailableActivities(activities)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This location is not in the preferred-facilities dropdown for this survey.
        </Typography>
      )}
    </Box>
  );
}
