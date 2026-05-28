export type RecommendationFailureCode =
  | "strict_facilities"
  | "no_matching_preferences"
  | "rain_filter"
  | "no_preferred_hours"
  | "no_available_hours"
  | "outdoor_rain"
  | "no_recommendations"
  | "unknown";

export type RecommendationFailure = {
  code: RecommendationFailureCode;
  userMessage: string;
};

const FAILURE_PATTERNS: {
  test: (reason: string, output: string) => boolean;
  code: RecommendationFailureCode;
  userMessage: string;
}[] = [
  {
    test: (reason) => reason.includes("preferred facilities is a hard filter"),
    code: "strict_facilities",
    userMessage:
      "We couldn't generate a schedule. With strict facility filter on, every visit must be at one of your preferred facilities and support at least one of your activities or exercise categories, and none of your choices matched. Try turning off strict facility filter, selecting more facilities, or adjusting your activities and categories.",
  },
  {
    test: (reason) => reason.includes("no matching activities or exercise categories"),
    code: "no_matching_preferences",
    userMessage:
      "We couldn't generate a schedule because none of the forecast times matched your preferred activities or exercise categories. Try adding more activities or categories.",
  },
  {
    test: (reason) =>
      reason.includes("rain is a hard filter") &&
      reason.includes("no available time when not raining"),
    code: "rain_filter",
    userMessage:
      "We couldn't generate a schedule. With rain filter on, every slot must be dry weather, and none were available. Try turning off rain filter or widening your preferred hours.",
  },
  {
    test: (reason) => reason.includes("no preferred days and hours"),
    code: "no_preferred_hours",
    userMessage:
      "We couldn't generate a schedule because no times fell within your preferred hours. Try marking more preferred times on the weekly grid.",
  },
  {
    test: (reason) => reason.includes("no available days and hours"),
    code: "no_available_hours",
    userMessage:
      "We couldn't generate a schedule because your unavailable hours blocked every option. Try reducing unavailable times on the weekly grid.",
  },
  {
    test: (reason) => reason.includes("no outdoor facilities available when raining"),
    code: "outdoor_rain",
    userMessage:
      "We couldn't generate a schedule because rainy weather ruled out all remaining outdoor options.",
  },
];

function extractReason(output: string): string {
  const matches = [...output.matchAll(/No recommendations found, reason: ([^\n]+)/g)];
  return matches.at(-1)?.[1]?.trim() ?? "";
}

/** Map recommender stdout/stderr to a user-facing message, or null if the run succeeded. */
export function parseRecommenderFailure(
  stdout: string,
  stderr: string,
): RecommendationFailure | null {
  const output = `${stdout}\n${stderr}`;
  if (!output.includes("No recommendations found")) {
    return null;
  }

  const reason = extractReason(output);
  for (const pattern of FAILURE_PATTERNS) {
    if (pattern.test(reason, output)) {
      return { code: pattern.code, userMessage: pattern.userMessage };
    }
  }

  if (
    output.includes("No recommendations found for current week or next week") ||
    output.includes("No recommendations found for either week")
  ) {
    return {
      code: "no_recommendations",
      userMessage:
        "We couldn't generate a schedule for this week or next week with your current preferences. Review your activities, facilities, and filters, then try again.",
    };
  }

  return {
    code: "unknown",
    userMessage:
      "We couldn't generate a schedule with your current preferences. Review your selections and try again.",
  };
}
