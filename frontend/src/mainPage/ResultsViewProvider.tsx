import { useMemo, useState, type ReactNode } from "react";
import { ResultsViewContext, type ResultsView } from "./resultsViewContext";

export function ResultsViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ResultsView>("recommendations");
  const [highlightedFacilities, setHighlightedFacilities] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [preferredFacilities, setPreferredFacilities] = useState<string[]>([]);

  const value = useMemo(
    () => ({
      view,
      setView,
      highlightedFacilities,
      setHighlightedFacilities,
      preferredFacilities,
      setPreferredFacilities,
      openLocationGuide: () => setView("locations"),
    }),
    [view, highlightedFacilities, preferredFacilities],
  );

  return <ResultsViewContext.Provider value={value}>{children}</ResultsViewContext.Provider>;
}
