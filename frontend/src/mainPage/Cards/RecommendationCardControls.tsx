import { useEffect, useRef, useState } from "react";
import type { CachedRecommendation } from "../../types";

interface RecommendationCardControlsProps {
  activeIndex: number;
  history: CachedRecommendation[];
  onActiveIndexChange: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onShuffle: () => void;
  shuffling: boolean;
  sliding: boolean;
}

const RecommendationCardControls = ({
  activeIndex,
  history,
  onActiveIndexChange,
  onPrev,
  onNext,
  onShuffle,
  shuffling,
  sliding,
}: RecommendationCardControlsProps) => {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const visibleCards =
    search.trim().length === 0
      ? history.slice(-3).reverse()
      : history.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchWrapRef.current) return;

      if (!searchWrapRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectCard = (id: string) => {
    const index = history.findIndex((item) => item.id === id);

    if (index === -1) return;

    onActiveIndexChange(index);
    setSearch("");
    setSearchOpen(false);
  };

  return (
    <div className="recommendation-card-controls">
      <div className="card-search-wrap" ref={searchWrapRef}>
        <span>⌕</span>

        <input
          value={search}
          placeholder="Search cards..."
          onChange={(event) => {
            setSearch(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
        />

        {searchOpen && (
          <div className="card-search-results">
            {visibleCards.length > 0 ? (
              visibleCards.map((item) => {
                const originalIndex = history.findIndex((card) => card.id === item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={originalIndex === activeIndex ? "active" : ""}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleSelectCard(item.id);
                    }}
                  >
                    <span>{item.name}</span>
                    <small>
                      {search.trim().length === 0
                        ? "Recent recommendation"
                        : `${item.result.currentWeek.overall.length} current week recs`}
                    </small>
                  </button>
                );
              })
            ) : (
              <p>No matching cards.</p>
            )}
          </div>
        )}
      </div>

      <div className="card-nav-actions">
        <button
          type="button"
          onClick={onPrev}
          disabled={history.length <= 1 || sliding || shuffling}
        >
          ←
        </button>

        <span>{history.length === 0 ? "0/0" : `${activeIndex + 1}/${history.length}`}</span>

        <button
          type="button"
          onClick={onNext}
          disabled={history.length <= 1 || sliding || shuffling}
        >
          →
        </button>

        <button
          type="button"
          className="shuffle-button"
          onClick={onShuffle}
          disabled={history.length <= 1 || sliding || shuffling}
        >
          ⤨
        </button>
      </div>
    </div>
  );
};

export default RecommendationCardControls;
