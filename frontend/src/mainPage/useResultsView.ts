import { useContext } from "react";
import { ResultsViewContext } from "./resultsViewContext";

export function useResultsView() {
  const context = useContext(ResultsViewContext);

  if (context === null) {
    throw new Error("useResultsView must be used within ResultsViewProvider");
  }

  return context;
}
