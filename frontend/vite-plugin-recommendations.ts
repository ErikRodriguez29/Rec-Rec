import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { preferencesToCliArgs } from "./src/utils/preferencesToCliArgs";
import type { UserPreferences } from "./src/types";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(pluginDir, "..");
const RECOMMENDER_DIR = path.join(repoRoot, "src/scripts/recommender");
const RECOMMEND_SCRIPT = path.join(RECOMMENDER_DIR, "recommend-times.py");
const RECOMMENDATIONS_JSON = path.join(repoRoot, "src/output/recommendations/recommendations.json");

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function runRecommendTimes(cliArgs: string[]): Promise<unknown> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("python3", [RECOMMEND_SCRIPT, ...cliArgs], {
      cwd: RECOMMENDER_DIR,
      env: process.env,
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(stderr.trim() || `recommend-times.py exited with code ${code}`));
        return;
      }
      resolve();
    });
  });

  const raw = await readFile(RECOMMENDATIONS_JSON, "utf-8");
  return JSON.parse(raw) as unknown;
}

async function handleRecommendations(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: { message: "Method not allowed" } });
    return;
  }

  let prefs: UserPreferences;
  try {
    prefs = JSON.parse(await readBody(req)) as UserPreferences;
  } catch {
    sendJson(res, 400, { ok: false, error: { message: "Invalid JSON body" } });
    return;
  }

  try {
    const cliArgs = preferencesToCliArgs(prefs);
    const payload = await runRecommendTimes(cliArgs);
    sendJson(res, 200, payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run recommender";
    sendJson(res, 500, { ok: false, error: { message } });
  }
}

export function attachRecommendationsMiddleware(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use((req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/recommendations") {
      next();
      return;
    }
    void handleRecommendations(req, res);
  });
}

export function recommendationsApiPlugin(): Plugin {
  return {
    name: "recommendations-api",
    configureServer: attachRecommendationsMiddleware,
    configurePreviewServer: attachRecommendationsMiddleware,
  };
}
