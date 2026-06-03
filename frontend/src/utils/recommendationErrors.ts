import type { RecommendationFailure } from "../types";

/**
 * User-facing messages for the structured error codes emitted by the recommender
 * (`src/scripts/recommender/errors.py`, surfaced via `recommendations.json` `{ ok: false, error }`).
 */
const MESSAGES: Record<string, string> = {
  preferred_facilities_hard_filter:
    'No times matched. With "Only show selected facilities" on, every recommendation must be at one ' +
    "of your preferred facilities AND support at least one of your chosen activities or exercise " +
    "categorie. None of your selections lined up. Try turning that filter off, picking more " +
    "facilities, or adjusting your activities and categories.",
  rain_hard_filter:
    "No times matched. With the rain filter on, every slot has to be dry, and the forecast left none " +
    "available. Try turning off the rain filter or widening your available hours.",
  no_available_slots:
    "No times matched. Your unavailable hours blocked every option. Try freeing up more time on the " +
    "weekly grid.",
};

const FALLBACK_MESSAGE =
  "We couldn't generate a schedule with your current preferences. Review your activities, " +
  "facilities, and filters, then try again.";

/** Generic failure for transport problems (recommender unreachable, non-JSON, etc.). */
export const GENERIC_RECOMMENDATION_FAILURE: RecommendationFailure = {
  userMessage:
    "We couldn't reach the recommender. Make sure it's running, then try again.",
};

/** Map a recommender error code (and its raw message) to a friendly failure for the UI. */
export function recommendationFailureFromCode(
  code: string | undefined,
  rawMessage?: string,
): RecommendationFailure {
  const userMessage = (code && MESSAGES[code]) || rawMessage || FALLBACK_MESSAGE;
  return { code, userMessage };
}
