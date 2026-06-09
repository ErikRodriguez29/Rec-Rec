import { createContext } from "react";

export type ResultsView = "recommendations" | "forecasts" | "locations";

export type ResultsViewContextValue = {
  highlightedFacilities: ReadonlySet<string>;
  openLocationGuide: () => void;
  preferredFacilities: string[];
  setHighlightedFacilities: (facilities: ReadonlySet<string>) => void;
  setPreferredFacilities: (facilities: string[]) => void;
  setView: (view: ResultsView) => void;
  view: ResultsView;
};

export const ResultsViewContext = createContext<ResultsViewContextValue | null>(null);
