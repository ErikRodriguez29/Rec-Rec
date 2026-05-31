import type { UserPreferences } from "../types";
import type { BackendJSON } from "./recommendationsAdapter";

export interface RecommendationsErrorPayload {
  code?: string;
  message: string;
  week?: string;
}

export class RecommendationsFailedError extends Error {
  readonly code?: string;
  readonly week?: string;

  constructor(error: RecommendationsErrorPayload) {
    super(error.message);
    this.name = "RecommendationsFailedError";
    this.code = error.code;
    this.week = error.week;
  }
}

interface RecommendationsApiSuccess {
  ok: true;
  current_week: BackendJSON["current_week"];
  next_week: BackendJSON["next_week"];
}

interface RecommendationsApiFailure {
  ok: false;
  error: RecommendationsErrorPayload;
}

type RecommendationsApiResponse = RecommendationsApiSuccess | RecommendationsApiFailure;

/**
 * Run recommend-times.py with CLI args derived from user preferences and return JSON output.
 */
export async function getRecommendations(prefs: UserPreferences): Promise<BackendJSON> {
  const res = await fetch("/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });

  let data: RecommendationsApiResponse;
  try {
    data = (await res.json()) as RecommendationsApiResponse;
  } catch {
    throw new Error(`Recommendations API returned non-JSON (HTTP ${res.status})`);
  }

  if (!res.ok && data.ok !== false) {
    throw new Error(`Recommendations API failed (HTTP ${res.status})`);
  }

  if (data.ok === false) {
    throw new RecommendationsFailedError(data.error);
  }

  return {
    current_week: data.current_week,
    next_week: data.next_week,
  };
}
