import { useState } from "react";
import { getRecommendations, RecommendationsApiError } from "../api/recommendations";
import type { CachedRecommendation, RecommendationFailure, UserPreferences } from "../types";
import PreferencesForm from "./panels/PreferencesForm";
import RecommendationsPanel from "./panels/RecommendationsPanel";
import ResultsViewSwitcher from "./panels/ResultsViewSwitcher";
import "./TwoPanelLayout.css";

const fallbackError: RecommendationFailure = {
  userMessage: "No recommendations matched those preferences. Try widening your filters.",
};

// Don't worry, it's just a brwoser side cache that stores recent recommendations
const RECOMMENDATIONS_CACHE_KEY = "rec-rec-recommendations-cache";
const MAX_CACHED_RECOMMENDATIONS = 8;

function loadCachedRecommendations(): CachedRecommendation[] {
  try {
    const raw = window.localStorage.getItem(RECOMMENDATIONS_CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as CachedRecommendation[]) : [];

    return cached.map((item, index) => ({
      ...item,
      colorTheme: item.colorTheme ?? "sage",
      name: item.name ?? `exercise_plan_${index + 1}`,
    }));
  } catch {
    return [];
  }
}

function saveCachedRecommendations(next: CachedRecommendation[]): void {
  window.localStorage.setItem(RECOMMENDATIONS_CACHE_KEY, JSON.stringify(next));
}

const TwoPanelLayout = () => {
  // cache array
  const [recommendationsCache, setRecommendationsCache] =
    useState<CachedRecommendation[]>(loadCachedRecommendations);

  // What recommendation is theuser on?
  const [activeRecommendationIndex, setActiveRecommendationIndex] = useState(0);
  const [error, setError] = useState<RecommendationFailure | null>(null);
  const [loading, setLoading] = useState(false);

  // All handling function for cache recommendation cards
  const handleSubmit = async (prefs: UserPreferences) => {
    setLoading(true);
    setError(null);

    try {
      const result = await getRecommendations(prefs);

      const cachedRecommendation: CachedRecommendation = {
        colorTheme: "sage",
        id: `${Date.now()}`,
        generatedAt: new Date().toISOString(),
        name: `exercise_plan_${recommendationsCache.length + 1}`,
        result,
      };

      setRecommendationsCache((current) => {
        const next = [cachedRecommendation, ...current].slice(0, MAX_CACHED_RECOMMENDATIONS);
        saveCachedRecommendations(next);
        return next;
      });

      setActiveRecommendationIndex(0);
    } catch (err) {
      setError({
        userMessage:
          err instanceof RecommendationsApiError && err.message
            ? err.message
            : fallbackError.userMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRenameRecommendation = (id: string, name: string) => {
    setRecommendationsCache((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, name } : item));
      saveCachedRecommendations(next);
      return next;
    });
  };

  const handleColorRecommendation = (id: string, colorTheme: string) => {
    setRecommendationsCache((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, colorTheme } : item));

      saveCachedRecommendations(next);
      return next;
    });
  };

  const handleDeleteRecommendation = (id: string) => {
    setRecommendationsCache((current) => {
      const deletedIndex = current.findIndex((item) => item.id === id);
      const next = current.filter((item) => item.id !== id);

      saveCachedRecommendations(next);

      setActiveRecommendationIndex((index) => {
        if (next.length === 0) return 0;
        if (deletedIndex < index) return index - 1;
        if (deletedIndex === index) return Math.min(index, next.length - 1);
        return index;
      });

      return next;
    });
  };

  // Start here to find Preferences Form for the right side
  // Then find RecommendationsPanel for the left side, and follow the props drilling to find the RecommendationCardMenu and RecommendationCardControls
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>UCSB Recreation Recommender</h1>
        <p>Find the best times to go to the gym based on your preferences and schedule.</p>
        <p>
          {" "}
          View on <a href="https://github.com/ErikRodriguez29/rec-rec">GitHub</a>
        </p>
      </header>

      <section className="panel-layout">
        <aside className="panel panel--form">
          <PreferencesForm loading={loading} onSubmit={handleSubmit} />
        </aside>

        <section className="panel--results">
          <ResultsViewSwitcher
            recommendationsView={
              <RecommendationsPanel
                activeIndex={activeRecommendationIndex}
                history={recommendationsCache}
                loading={loading}
                error={error}
                onActiveIndexChange={setActiveRecommendationIndex}
                onColorChange={handleColorRecommendation}
                onDelete={handleDeleteRecommendation}
                onRename={handleRenameRecommendation}
              />
            }
          />
        </section>
      </section>
    </main>
  );
};

export default TwoPanelLayout;
