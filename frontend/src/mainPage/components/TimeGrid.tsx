import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
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

function slotFromPointerTarget(target: EventTarget | null): string | null {
  const cell = (target as Element | null)?.closest<HTMLButtonElement>("[data-slot]");
  return cell?.dataset.slot ?? null;
}

const TimeGrid = ({ slots, onChange }: TimeGridProps) => {
  const [mode, setMode] = useState<SlotState>("preferred");
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, removing: false, dragMode: "preferred" as SlotState });
  const pendingRef = useRef(new Map<string, SlotState>());
  const latestRef = useRef(slots);

  useEffect(() => {
    latestRef.current = slots;
  }, [slots]);

  const beginDrag = (slot: string) => {
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

  const paintSlot = (slot: string) => {
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

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;

    if (gridRef.current?.hasPointerCapture(event.pointerId)) {
      gridRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const handleCellPointerDown = (event: PointerEvent<HTMLButtonElement>, slot: string) => {
    event.preventDefault();
    gridRef.current?.setPointerCapture(event.pointerId);
    beginDrag(slot);
  };

  const handleGridPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;

    const slot = slotFromPointerTarget(document.elementFromPoint(event.clientX, event.clientY));
    if (slot) paintSlot(slot);
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
            <i className="swatch swatch--preferred" /> Preferred
          </span>
          <span>
            <i className="swatch swatch--unavailable" /> Busy
          </span>
        </div>
      </div>

      <div
        ref={gridRef}
        className="time-grid"
        style={{ "--days": DAY_CONFIGS.length } as GridStyle}
        onPointerCancel={endDrag}
        onPointerMove={handleGridPointerMove}
        onPointerUp={endDrag}
      >
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
                  data-slot={slot}
                  key={slot}
                  type="button"
                  onPointerDown={(event) => handleCellPointerDown(event, slot)}
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
