import { useCallback } from "react";
import { FACILITY_MAP_HOTSPOTS, REC_CENTER_MAP_LABELS } from "../../facilityMapHotspots";
import {
  formatAvailableActivities,
  getActivitiesForLocation,
  type FacilityLocation,
} from "../../facilityLocations";
import { useResultsView } from "../useResultsView";
import "./FacilitiesMap.css";

type FacilitiesMapProps = {
  onSelectMapNumber: (mapNumber: number | null) => void;
  selectedMapNumber: number | null;
};

export function FacilitiesMap({ selectedMapNumber, onSelectMapNumber }: FacilitiesMapProps) {
  const toggleMarker = useCallback(
    (number: number) => {
      onSelectMapNumber(selectedMapNumber === number ? null : number);
    },
    [onSelectMapNumber, selectedMapNumber],
  );

  return (
    <div className="facilities-map-wrap">
      <img
        alt="UCSB Recreation Center facilities map with numbered locations"
        className="facilities-map-image"
        src="/facilities-map.png"
      />

      {FACILITY_MAP_HOTSPOTS.map((hotspot) => {
        const selected = selectedMapNumber === hotspot.number;

        return (
          <button
            key={hotspot.number}
            aria-label={`Location ${hotspot.number}: ${REC_CENTER_MAP_LABELS[hotspot.number] ?? "facility"}`}
            aria-pressed={selected}
            className={`facilities-map-marker${selected ? " facilities-map-marker--selected" : ""}`}
            style={{
              left: `${hotspot.cx}%`,
              top: `${hotspot.cy}%`,
              width: `${hotspot.r * 2}%`,
            }}
            type="button"
            onClick={() => toggleMarker(hotspot.number)}
          >
            {hotspot.number}
          </button>
        );
      })}
    </div>
  );
}

type MapSelectionDetailsProps = {
  locations: FacilityLocation[];
  mapNumber: number;
};

export function MapSelectionDetails({ mapNumber, locations }: MapSelectionDetailsProps) {
  const { preferredFacilities, setPreferredFacilities } = useResultsView();
  const legendLabel = REC_CENTER_MAP_LABELS[mapNumber];
  const facilitiesToAdd = [...new Set(locations.flatMap((entry) => [...entry.optionNames]))].filter(
    (name) => !preferredFacilities.includes(name),
  );

  return (
    <div className="map-selection-details">
      <h4>
        Location #{mapNumber}
        {legendLabel !== undefined ? `: ${legendLabel}` : ""}
      </h4>

      {locations.length > 0 ? (
        <>
          {facilitiesToAdd.length > 0 ? (
            <button
              className="calendar-link-button"
              type="button"
              onClick={() => setPreferredFacilities([...preferredFacilities, ...facilitiesToAdd])}
            >
              Add to preferred facilities
            </button>
          ) : (
            <p className="map-selection-details-copy">Already in preferred facilities.</p>
          )}

          <ul>
            {locations.map((entry) => {
              const activities = getActivitiesForLocation(entry);

              return (
                <li key={entry.facilities}>
                  <p className="map-selection-details-title">
                    {entry.facilities}
                    {entry.note !== undefined ? ` (${entry.note})` : ""}
                  </p>
                  <p className="map-selection-details-copy">
                    Facilities in this location: {entry.optionNames.join(", ")}
                  </p>
                  <p className="map-selection-details-copy">
                    Available activities: {formatAvailableActivities(activities)}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="map-selection-details-copy">
          This location is not in the preferred-facilities dropdown for this survey.
        </p>
      )}
    </div>
  );
}
