import { Box, Stack, Typography, alpha } from "@mui/material";
import { FACILITY_LOCATIONS, isFacilityLocationHighlighted } from "./facilityLocations";

function formatMapRef(mapNumbers: number[]): string {
  return mapNumbers.map((n) => `#${n}`).join(", ");
}

type FacilityLocationGuideProps = {
  highlightedFacilities?: ReadonlySet<string>;
};

export default function FacilityLocationGuide({
  highlightedFacilities,
}: FacilityLocationGuideProps) {
  const showHighlights = highlightedFacilities !== undefined && highlightedFacilities.size > 0;

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
      <Box
        component="img"
        src="/facilities-map.png"
        alt="UCSB Recreation Center facilities map with numbered locations"
        sx={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
        }}
      />
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        UCSB Recreation Center facilities map
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Each option in preferred facilities corresponds to a numbered location on the map:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {FACILITY_LOCATIONS.map((entry) => {
          const highlighted =
            showHighlights && isFacilityLocationHighlighted(entry, highlightedFacilities);
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
                ...(highlighted
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
                — {formatMapRef(entry.mapNumbers)}
                {entry.note !== undefined ? ` (${entry.note})` : ""}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}
