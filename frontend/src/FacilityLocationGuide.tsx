import { Box, Link, Stack, Typography, alpha } from "@mui/material";
import { useMemo, useState } from "react";
import { FacilitiesMap, MapSelectionDetails } from "./FacilitiesMap";
import {
  entryMatchesMapNumber,
  formatAvailableActivities,
  getActivitiesForLocation,
  getFacilityLocationsByMapNumber,
  getFacilityLocationsSortedByMapNumber,
  isFacilityLocationHighlighted,
} from "./facilityLocations";

function formatMapRef(
  mapNumbers: number[],
  onSelect: (n: number) => void,
  selected: number | null,
) {
  return mapNumbers.map((n, i) => (
    <span key={n}>
      {i > 0 ? ", " : ""}
      <Link
        component="button"
        type="button"
        variant="body2"
        underline="hover"
        onClick={() => onSelect(n)}
        sx={{
          fontWeight: selected === n ? 700 : 500,
          color: selected === n ? "primary.main" : "text.secondary",
          verticalAlign: "baseline",
        }}
      >
        #{n}
      </Link>
    </span>
  ));
}

type FacilityLocationGuideProps = {
  highlightedFacilities?: ReadonlySet<string>;
};

export default function FacilityLocationGuide({
  highlightedFacilities,
}: FacilityLocationGuideProps) {
  const [selectedMapNumber, setSelectedMapNumber] = useState<number | null>(null);
  const showHighlights = highlightedFacilities !== undefined && highlightedFacilities.size > 0;

  const selectedLocations = useMemo(
    () => (selectedMapNumber === null ? [] : getFacilityLocationsByMapNumber(selectedMapNumber)),
    [selectedMapNumber],
  );

  const locationsByMapNumber = useMemo(() => getFacilityLocationsSortedByMapNumber(), []);

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Use the numbered map below to see where each facility in the dropdown is located on campus.
      </Typography>
      {showHighlights && (
        <Typography variant="body2" color="text.secondary">
          Rows with a light blue background match facilities in your recommendations.
        </Typography>
      )}
      <FacilitiesMap
        selectedMapNumber={selectedMapNumber}
        onSelectMapNumber={setSelectedMapNumber}
      />
      <Typography variant="body2" color="text.secondary">
        Click a numbered circle on the map to see which facilities are at that location.
      </Typography>
      {selectedMapNumber !== null && (
        <MapSelectionDetails mapNumber={selectedMapNumber} locations={selectedLocations} />
      )}
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        UCSB Recreation Center Facilities Map
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Each option in preferred facilities corresponds to a numbered location on the map
      </Typography>
      <Typography variant="body2" color="text.secondary">
        See the original map on the UCSB Recreation Center website{" "}
        <a
          href="https://recreation.ucsb.edu/facilities/livecount"
          target="_blank"
          rel="noopener noreferrer"
        >
          here
        </a>
        .
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {locationsByMapNumber.map((entry) => {
          const activities = getActivitiesForLocation(entry);
          const highlighted =
            showHighlights && isFacilityLocationHighlighted(entry, highlightedFacilities);
          const mapSelected =
            selectedMapNumber !== null && entryMatchesMapNumber(entry, selectedMapNumber);
          return (
            <Box
              component="li"
              key={entry.facilities}
              sx={{
                mb: 1,
                py: 0.75,
                px: 1,
                ml: -1,
                borderRadius: 1,
                ...(highlighted || mapSelected
                  ? {
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                          ? alpha(theme.palette.info.light, 0.22)
                          : "#e3f2fd",
                    }
                  : {}),
              }}
            >
              <Typography variant="body2" component="span">
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {entry.facilities}
                </Box>{" "}
                — {formatMapRef(entry.mapNumbers, setSelectedMapNumber, selectedMapNumber)}
                {entry.note !== undefined ? ` (${entry.note})` : ""}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Available activities: {formatAvailableActivities(activities)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}
