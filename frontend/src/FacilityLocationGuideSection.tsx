import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Link,
  Paper,
  Typography,
} from "@mui/material";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import FacilityLocationGuide from "./FacilityLocationGuide";
import {
  collectRecommendedFacilityNames,
  type RecommendationsPayload,
} from "./recommendationsTypes";

export const FACILITY_LOCATION_GUIDE_ID = "facility-location-guide";

type FacilityGuideContextValue = {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  openGuide: () => void;
  highlightedFacilities: ReadonlySet<string>;
};

const FacilityGuideContext = createContext<FacilityGuideContextValue | null>(null);

export function FacilityGuideProvider({
  children,
  recommendations,
}: {
  children: ReactNode;
  recommendations: RecommendationsPayload | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const highlightedFacilities = useMemo(() => {
    if (recommendations === null) return new Set<string>();
    return collectRecommendedFacilityNames(recommendations);
  }, [recommendations]);

  const openGuide = useCallback(() => {
    setExpanded(true);
    requestAnimationFrame(() => {
      document.getElementById(FACILITY_LOCATION_GUIDE_ID)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const value = useMemo(
    () => ({ expanded, setExpanded, openGuide, highlightedFacilities }),
    [expanded, openGuide, highlightedFacilities],
  );

  return <FacilityGuideContext.Provider value={value}>{children}</FacilityGuideContext.Provider>;
}

function useFacilityGuide() {
  const ctx = useContext(FacilityGuideContext);
  if (ctx === null) {
    throw new Error("FacilityGuideLink must be used within FacilityGuideProvider");
  }
  return ctx;
}

export function FacilityGuideLink({ children }: { children?: ReactNode }) {
  const { openGuide } = useFacilityGuide();

  return (
    <Link
      href={`#${FACILITY_LOCATION_GUIDE_ID}`}
      underline="hover"
      onClick={(e) => {
        e.preventDefault();
        openGuide();
      }}
      sx={{ fontWeight: 600, color: "primary.main", cursor: "pointer" }}
    >
      {children ?? "facility location guide"}
    </Link>
  );
}

export default function FacilityLocationGuideSection() {
  const { expanded, setExpanded, highlightedFacilities } = useFacilityGuide();

  return (
    <Paper
      id={FACILITY_LOCATION_GUIDE_ID}
      elevation={0}
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: "background.paper",
        scrollMarginTop: 24,
      }}
    >
      <Accordion
        expanded={expanded}
        onChange={(_, nextExpanded) => setExpanded(nextExpanded)}
        disableGutters
        elevation={0}
        sx={{
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary
          aria-controls="facility-location-guide-content"
          id="facility-location-guide-header"
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Facility Location Guide
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <FacilityLocationGuide highlightedFacilities={highlightedFacilities} />
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}
