import { useState } from "react";
import type { CachedRecommendation, RecommendationFailure } from "../../types";
import RecommendationCardControls from "../Cards/RecommendationCardControls";
import RecommendationCardMenu from "../Cards/RecommendationCardMenu";
import RecommendationWeekView from "../Cards/RecommendationWeekView";
import RecommendationCalendarExport from "../Cards/RecommendationCalendarExport";
import "./RecommendationsPanel.css";

interface RecommendationsPanelProps {
  activeIndex: number;
  error?: RecommendationFailure | null;
  history: CachedRecommendation[];
  loading: boolean;
  onActiveIndexChange: (index: number) => void;
  onColorChange: (id: string, colorTheme: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDismissError?: () => void;
}

type WeekKey = "current" | "next";
type SlideDirection = "next" | "prev" | null;

const RecommendationsPanel = ({
  activeIndex,
  error,
  history,
  loading,
  onActiveIndexChange,
  onColorChange,
  onDelete,
  onRename,
  onDismissError,
}: RecommendationsPanelProps) => {
  const [week, setWeek] = useState<WeekKey>("current");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>(null);

  const activeItem = history[activeIndex] ?? null;

  const nextItem = history.length > 1 ? history[(activeIndex + 1) % history.length] : null;

  const secondNextItem = history.length > 2 ? history[(activeIndex + 2) % history.length] : null;

  const activeRecs =
    week === "current" ? activeItem?.result.currentWeek : activeItem?.result.nextWeek;

  const changeCardWithSlide = (nextIndex: number, direction: "next" | "prev") => {
    if (history.length <= 1 || slideDirection || shuffling) return;

    setSlideDirection(direction);

    window.setTimeout(() => {
      onActiveIndexChange(nextIndex);
    }, 180);

    window.setTimeout(() => {
      setSlideDirection(null);
    }, 360);
  };

  const handlePrev = () => {
    if (history.length === 0) return;

    const nextIndex = (activeIndex - 1 + history.length) % history.length;
    changeCardWithSlide(nextIndex, "prev");
  };

  const handleNext = () => {
    if (history.length === 0) return;

    const nextIndex = (activeIndex + 1) % history.length;
    changeCardWithSlide(nextIndex, "next");
  };

  const handleShuffle = () => {
    if (history.length <= 1 || shuffling || slideDirection) return;

    setShuffling(true);

    window.setTimeout(() => {
      let nextIndex = activeIndex;

      while (nextIndex === activeIndex) {
        nextIndex = Math.floor(Math.random() * history.length);
      }

      onActiveIndexChange(nextIndex);
    }, 360);

    window.setTimeout(() => {
      setShuffling(false);
    }, 720);
  };

  const handleSearchSelect = (nextIndex: number) => {
    if (nextIndex === activeIndex) return;

    const direction = nextIndex > activeIndex ? "next" : "prev";
    changeCardWithSlide(nextIndex, direction);
  };

  const handleReturnToPreviousCards = () => {
    onDismissError?.();

    if (history.length > 0) {
      onActiveIndexChange(Math.min(activeIndex, history.length - 1));
    }
  };

  const stackClassName = [
    "recommendation-stack",
    shuffling ? "is-shuffling" : "",
    slideDirection === "next" ? "is-sliding-next" : "",
    slideDirection === "prev" ? "is-sliding-prev" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="recommendations-panel">
      <div className="section-title">
        <h2>Recommendations</h2>
      </div>

      <RecommendationCardControls
        activeIndex={activeIndex}
        history={history}
        onActiveIndexChange={handleSearchSelect}
        onPrev={handlePrev}
        onNext={handleNext}
        onShuffle={handleShuffle}
        shuffling={shuffling}
        sliding={slideDirection !== null}
      />

      {error ? (
        <div className="recommendations-empty-state error-state">
          <h3>No recommendations found</h3>
          <p>{error.userMessage}</p>

          {history.length > 0 && (
            <button
              type="button"
              className="return-cards-button"
              onClick={handleReturnToPreviousCards}
            >
              Return to previous recommendations
            </button>
          )}
        </div>
      ) : activeItem === null ? (
        <div className="recommendations-empty-state">
          <h3>{loading ? "Finding best times..." : "No recommendations yet"}</h3>
          <p>Choose your preferences and run the planner.</p>
        </div>
      ) : (
        <div className="recommendations-deck-layout">
          <div className={stackClassName}>
            {secondNextItem && (
              <div
                className={`recommendation-card card-back card-back-two theme-${secondNextItem.colorTheme}`}
              >
                <div className="back-card-label">{secondNextItem.name}</div>
              </div>
            )}

            {nextItem && (
              <div
                className={`recommendation-card card-back card-back-one theme-${nextItem.colorTheme}`}
              >
                <div className="back-card-label">{nextItem.name}</div>
              </div>
            )}

            <article className={`recommendation-card active-card theme-${activeItem.colorTheme}`}>
              <RecommendationCardMenu
                item={activeItem}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                onColorChange={onColorChange}
                onDelete={onDelete}
                onRename={onRename}
              />

              <div className="recommendation-card-header">
                <div>
                  <p className="recommendation-card-eyebrow">
                    {week === "current" ? "Current week" : "Next week"}
                  </p>

                  <h3 className="recommendation-card-title">{activeItem.name}</h3>
                </div>

                <div
                  className="recommendations-tabs"
                  role="tablist"
                  aria-label="Recommendation week"
                >
                  <button
                    aria-selected={week === "current"}
                    className={week === "current" ? "active" : ""}
                    type="button"
                    onClick={() => setWeek("current")}
                  >
                    Current week
                  </button>

                  <button
                    aria-selected={week === "next"}
                    className={week === "next" ? "active" : ""}
                    type="button"
                    onClick={() => setWeek("next")}
                  >
                    Next week
                  </button>
                </div>
              </div>

              <p className="recommendation-card-copy">
                Preview the schedule below, then download it as an .ics calendar file.
              </p>
            </article>
          </div>

          {activeRecs && (
            <div className="recommendations-below-card">
              <RecommendationCalendarExport recs={activeRecs} week={week} name={activeItem.name} />

              <section className="recommendations-plan-panel">
                <div className="recommendations-plan-heading">
                  <p>Detailed plan</p>
                  <h3>Overall Plan + By Category</h3>
                </div>

                <RecommendationWeekView recs={activeRecs} />
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecommendationsPanel;
