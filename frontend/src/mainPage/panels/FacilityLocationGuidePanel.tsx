import { useMemo, useState } from "react";
import {
  entryMatchesMapNumber,
  formatAvailableActivities,
  getActivitiesForLocation,
  getFacilityLocationsByMapNumber,
  getFacilityLocationsSortedByMapNumber,
  isFacilityLocationHighlighted,
} from "../../facilityLocations";
import { useResultsView } from "../useResultsView";
import { FacilitiesMap, MapSelectionDetails } from "./FacilitiesMap";
import "./FacilityLocationGuidePanel.css";

function formatMapRef(
  mapNumbers: number[],
  onSelect: (mapNumber: number) => void,
  selected: number | null,
) {
  return mapNumbers.map((mapNumber, index) => (
    <span key={mapNumber}>
      {index > 0 ? ", " : ""}
      <button
        className={`facility-location-map-link${selected === mapNumber ? " active" : ""}`}
        type="button"
        onClick={() => onSelect(mapNumber)}
      >
        #{mapNumber}
      </button>
    </span>
  ));
}

const FacilityLocationGuidePanel = () => {
  const { highlightedFacilities } = useResultsView();
  const [selectedMapNumber, setSelectedMapNumber] = useState<number | null>(null);
  const showHighlights = highlightedFacilities.size > 0;

  const selectedLocations = useMemo(
    () => (selectedMapNumber === null ? [] : getFacilityLocationsByMapNumber(selectedMapNumber)),
    [selectedMapNumber],
  );

  const locationsByMapNumber = useMemo(() => getFacilityLocationsSortedByMapNumber(), []);

  return (
    <div className="facility-location-panel">
      <div className="section-title">
        <h2>Facility Location Guide</h2>
      </div>

      <div className="facility-location-guide">
        <p className="facility-location-copy">
          Use the numbered map below to see where each facility in the dropdown is located on
          campus.
        </p>

        {showHighlights && (
          <p className="facility-location-copy">
            Rows with a light blue background match facilities in your recommendations.
          </p>
        )}

        <FacilitiesMap
          selectedMapNumber={selectedMapNumber}
          onSelectMapNumber={setSelectedMapNumber}
        />

        <p className="facility-location-copy">
          Click a numbered circle on the map to see which activities are at that location.
        </p>

        {selectedMapNumber !== null && (
          <MapSelectionDetails locations={selectedLocations} mapNumber={selectedMapNumber} />
        )}

        <h3 className="facility-location-subtitle">UCSB Recreation Center Facilities Map</h3>

        <p className="facility-location-copy">
          Each option in preferred facilities corresponds to a numbered location on the map. See the
          original map on the UCSB Recreation Center website{" "}
          <a
            href="https://recreation.ucsb.edu/facilities/livecount"
            rel="noopener noreferrer"
            target="_blank"
          >
            here
          </a>
          .
        </p>

        <ul className="facility-location-list">
          {locationsByMapNumber.map((entry) => {
            const activities = getActivitiesForLocation(entry);
            const highlighted =
              showHighlights && isFacilityLocationHighlighted(entry, highlightedFacilities);
            const mapSelected =
              selectedMapNumber !== null && entryMatchesMapNumber(entry, selectedMapNumber);

            return (
              <li
                key={entry.facilities}
                className={[
                  highlighted ? "facility-location-list-item--highlighted" : "",
                  mapSelected ? "facility-location-list-item--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p className="facility-location-list-title">
                  <strong>{entry.facilities}</strong> —{" "}
                  {formatMapRef(entry.mapNumbers, setSelectedMapNumber, selectedMapNumber)}
                  {entry.note !== undefined ? ` (${entry.note})` : ""}
                </p>
                <p className="facility-location-list-copy">
                  Available activities: {formatAvailableActivities(activities)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default FacilityLocationGuidePanel;
