import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DAY_CONFIGS } from "../../constants";
import type { SlotState } from "../../types";

const gridHours = Array.from({ length: 17 }, (_, index) => index + 6);

type GridStyle = CSSProperties & { "--days": number };

export interface TimeGridProps {
  slots: Map<string, SlotState>;
  onChange: (slots: Map<string, SlotState>) => void;
}

function toLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

const TimeGrid = ({ slots, onChange }: TimeGridProps) => {
  const [mode, setMode] = useState<SlotState>("preferred");
  const dragRef = useRef({ active: false, removing: false, dragMode: "preferred" as SlotState });
  const pendingRef = useRef(new Map<string, SlotState>());
  const latestRef = useRef(slots);

  useEffect(() => {
    latestRef.current = slots;
  }, [slots]);

  useEffect(() => {
    const stopDrag = () => {
      dragRef.current.active = false;
    };

    window.addEventListener("mouseup", stopDrag);
    return () => window.removeEventListener("mouseup", stopDrag);
  }, []);

  const handleMouseDown = (slot: string) => {
    const currentState = latestRef.current.get(slot);
    if (currentState && currentState !== mode) return;

    const removing = currentState === mode;
    dragRef.current = { active: true, removing, dragMode: mode };
    pendingRef.current = new Map(latestRef.current);

    if (removing) {
      pendingRef.current.delete(slot);
    } else {
      pendingRef.current.set(slot, mode);
    }

    onChange(new Map(pendingRef.current));
  };

  const handleMouseEnter = (slot: string) => {
    if (!dragRef.current.active) return;

    const { dragMode, removing } = dragRef.current;
    const currentState = pendingRef.current.get(slot);

    if (removing) {
      if (currentState !== dragMode) return;
      pendingRef.current.delete(slot);
    } else {
      if (currentState) return;
      pendingRef.current.set(slot, dragMode);
    }

    onChange(new Map(pendingRef.current));
  };

  return (
    <div className="time-grid-wrap">
      <div className="mode-row">
        <div className="segmented-control">
          <button
            className={mode === "preferred" ? "active preferred" : ""}
            type="button"
            onClick={() => setMode("preferred")}
          >
            Preferred
          </button>
          <button
            className={mode === "unavailable" ? "active unavailable" : ""}
            type="button"
            onClick={() => setMode("unavailable")}
          >
            Unavailable
          </button>
        </div>
        <div className="legend">
          <span>
            <i className="swatch swatch--preferred" /> Free
          </span>
          <span>
            <i className="swatch swatch--unavailable" /> Busy
          </span>
        </div>
      </div>

      <div className="time-grid" style={{ "--days": DAY_CONFIGS.length } as GridStyle}>
        <span />
        {DAY_CONFIGS.map(({ code, name }) => (
          <span className="grid-label day-label" key={code}>
            {name.slice(0, 3)}
          </span>
        ))}

        {gridHours.map((hour, hourIndex) => (
          <Fragment key={hour}>
            <span className="grid-label hour-label">
              {hourIndex % 2 === 0 ? toLabel(hour) : ""}
            </span>
            {DAY_CONFIGS.map(({ code }) => {
              const slot = `${code}-${hour}`;
              const state = slots.get(slot);
              const locked = state && state !== mode;

              return (
                <button
                  aria-label={`${code} ${toLabel(hour)}`}
                  className={[
                    "time-cell",
                    state ? `time-cell--${state}` : "",
                    locked ? "time-cell--locked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={slot}
                  type="button"
                  onMouseDown={() => handleMouseDown(slot)}
                  onMouseEnter={() => handleMouseEnter(slot)}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
};

export default TimeGrid;
