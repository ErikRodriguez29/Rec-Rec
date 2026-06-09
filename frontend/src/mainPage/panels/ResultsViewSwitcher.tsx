import type { ReactNode } from "react";
import FacilityForecastCards from "./FacilityForecastCards";
import FacilityLocationGuidePanel from "./FacilityLocationGuidePanel";
import { useResultsView } from "../useResultsView";
import "./ResultsViewSwitcher.css";

interface ResultsViewSwitcherProps {
  recommendationsView: ReactNode;
}

const ResultsViewSwitcher = ({ recommendationsView }: ResultsViewSwitcherProps) => {
  const { view, setView } = useResultsView();

  return (
    <div className="results-tabs-shell">
      <div className="results-tabs" role="tablist" aria-label="Results views">
        <button
          type="button"
          role="tab"
          aria-selected={view === "recommendations"}
          className={`results-tab ${view === "recommendations" ? "active" : ""}`}
          onClick={() => setView("recommendations")}
        >
          <span>Recommendations</span>
          <small>Workout cards</small>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={view === "locations"}
          className={`results-tab ${view === "locations" ? "active" : ""}`}
          onClick={() => setView("locations")}
        >
          <span>Locations</span>
          <small>Facility map</small>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={view === "forecasts"}
          className={`results-tab ${view === "forecasts" ? "active" : ""}`}
          onClick={() => setView("forecasts")}
        >
          <span>Forecasts</span>
          <small>Facility demand</small>
        </button>
      </div>

      <div className={`results-tab-body view-${view}`}>
        {view === "recommendations" && recommendationsView}
        {view === "locations" && <FacilityLocationGuidePanel />}
        {view === "forecasts" && <FacilityForecastCards />}
      </div>
    </div>
  );
};

export default ResultsViewSwitcher;
