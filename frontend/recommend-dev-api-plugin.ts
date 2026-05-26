import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { access, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import process from "node:process";
import type { Plugin, ViteDevServer } from "vite";

import { getForecastHeatmapWeekNumbers } from "./predictionWeeks.ts";

export type RecommendRequestBody = {
  preferredActivities?: string;
  preferredExerciseCategories?: string;
  preferredDaysHours?: string;
  unavailableDaysHours?: string;
  preferredFacilities?: string;
  rainFilter?: string;
  preferredFacilitiesHardFilter?: string;
};

function readReqBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on("data", (chunk: Uint8Array) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function buildPythonArgs(scriptPath: string, body: RecommendRequestBody): string[] {
  const args = [scriptPath];
  const push = (flag: string, value: string) => {
    args.push(flag, value);
  };
  if (typeof body.preferredActivities === "string" && body.preferredActivities.length > 0)
    push("--preferred-activities", body.preferredActivities);
  if (
    typeof body.preferredExerciseCategories === "string" &&
    body.preferredExerciseCategories.length > 0
  )
    push("--preferred-exercise-categories", body.preferredExerciseCategories);
  const preferredDays =
    typeof body.preferredDaysHours === "string" && body.preferredDaysHours.trim().length > 0
      ? body.preferredDaysHours.trim()
      : undefined;
  if (preferredDays) push("--preferred-days-hours", preferredDays);

  const unavailable =
    typeof body.unavailableDaysHours === "string" && body.unavailableDaysHours.trim().length > 0
      ? body.unavailableDaysHours.trim()
      : "None";
  push("--unavailable-days-hours", unavailable);

  if (typeof body.preferredFacilities === "string" && body.preferredFacilities.trim().length > 0)
    push("--preferred-facilities", body.preferredFacilities.trim());
  const rain =
    typeof body.rainFilter === "string" && body.rainFilter.length > 0 ? body.rainFilter : undefined;
  if (rain !== undefined && rain !== "") push("--rain-filter", rain);
  const facHard =
    typeof body.preferredFacilitiesHardFilter === "string" &&
    body.preferredFacilitiesHardFilter.length > 0
      ? body.preferredFacilitiesHardFilter
      : undefined;
  if (facHard !== undefined && facHard !== "") push("--preferred-facilities-hard-filter", facHard);
  return args;
}

function runRecommend(
  cwd: string,
  scriptRelative: string,
  body: RecommendRequestBody,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const scriptPath = join(cwd, scriptRelative);
  const argv = buildPythonArgs(scriptPath, body);
  return new Promise((resolve, reject) => {
    const py = spawn("python3", argv, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      shell: false,
    });
    const out: string[] = [];
    const err: string[] = [];
    py.stdout.setEncoding("utf8");
    py.stderr.setEncoding("utf8");
    py.stdout.on("data", (d: string) => {
      out.push(d);
    });
    py.stderr.on("data", (d: string) => {
      err.push(d);
    });
    py.on("error", reject);
    py.on("close", (code) => {
      resolve({
        stdout: out.join(""),
        stderr: err.join(""),
        exitCode: code,
      });
    });
  });
}

async function readRecommendationsJson(recommendationsPath: string): Promise<unknown> {
  try {
    const text = await readFile(recommendationsPath, "utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

const PREDICTION_HEATMAP_FILENAME = "1All Facilities Forecast.png";

function predictionHeatmapPath(repoRoot: string, weekNumber: number) {
  return join(
    repoRoot,
    "src",
    "output",
    "predictions",
    `Week ${weekNumber}`,
    PREDICTION_HEATMAP_FILENAME,
  );
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function attachDevApiMiddleware(
  repoRoot: string,
  recommendationsPath: string,
  scriptDir: string,
  scriptRelative: string,
  middlewares: ViteDevServer["middlewares"],
) {
  middlewares.use(async (req, res, next) => {
    const raw = req.url ?? "";
    const pathname = raw.split("?")[0] ?? "";

    const isRecommendPost = pathname === "/api/recommend";
    const isRecommendationsGet = pathname === "/api/recommendations";
    const isPredictionWeeksGet = pathname === "/api/prediction-weeks";
    const heatmapMatch = /^\/api\/predictions\/heatmap\/(\d+)$/.exec(pathname);

    if (
      !isRecommendPost &&
      !isRecommendationsGet &&
      !isPredictionWeeksGet &&
      heatmapMatch === null
    ) {
      next();
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    const methods = new Set<string>(["OPTIONS"]);
    if (isRecommendPost) methods.add("POST");
    if (isRecommendationsGet || isPredictionWeeksGet || heatmapMatch !== null) methods.add("GET");
    res.setHeader("Access-Control-Allow-Methods", [...methods].join(", "));
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (isPredictionWeeksGet) {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }
      sendJson(res, 200, getForecastHeatmapWeekNumbers());
      return;
    }

    if (heatmapMatch !== null) {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }
      const weekNumber = Number(heatmapMatch[1]);
      const filePath = predictionHeatmapPath(repoRoot, weekNumber);
      try {
        await access(filePath);
        const image = await readFile(filePath);
        res.statusCode = 200;
        res.setHeader("Content-Type", "image/png");
        res.end(image);
      } catch {
        res.statusCode = 404;
        res.end();
      }
      return;
    }

    if (isRecommendationsGet) {
      if (req.method !== "GET") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }
      const recommendations = await readRecommendationsJson(recommendationsPath);
      if (recommendations === null) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: "recommendations.json not found. Run the recommender first.",
            path: recommendationsPath,
          }),
        );
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, recommendations }));
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    let bodyText: string;
    try {
      bodyText = await readReqBody(req);
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Failed to read body" }));
      return;
    }

    let parsed: RecommendRequestBody;
    try {
      parsed = JSON.parse(bodyText) as RecommendRequestBody;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("bad shape");
      }
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Expected JSON body" }));
      return;
    }

    try {
      const { stdout, stderr, exitCode } = await runRecommend(scriptDir, scriptRelative, parsed);
      const recommendations =
        exitCode === 0 ? await readRecommendationsJson(recommendationsPath) : null;
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: exitCode === 0,
          exitCode,
          stdout,
          stderr,
          recommendations,
        }),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to start Python runner";
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          exitCode: null,
          stdout: "",
          stderr: "",
          error: message,
        }),
      );
    }
  });
}

/** Dev-only: runs recommend-times.py; serves recommendations JSON and prediction heatmaps. */
export function recommendDevApiPlugin(repoRoot: string): Plugin {
  const scriptDir = join(repoRoot, "src", "scripts", "recommender");
  const scriptRelative = "recommend-times.py";
  const recommendationsPath = join(
    repoRoot,
    "src",
    "output",
    "recommendations",
    "recommendations.json",
  );

  return {
    name: "recommend-dev-api",
    configureServer(server) {
      attachDevApiMiddleware(
        repoRoot,
        recommendationsPath,
        scriptDir,
        scriptRelative,
        server.middlewares,
      );
    },
    configurePreviewServer(server) {
      attachDevApiMiddleware(
        repoRoot,
        recommendationsPath,
        scriptDir,
        scriptRelative,
        server.middlewares,
      );
    },
  };
}
