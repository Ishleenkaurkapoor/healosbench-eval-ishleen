// apps/server/src/index.ts

import { auth } from "@test-evals/auth";
import { env } from "@test-evals/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";  // ← ADD
import { runnerService } from "./services/runner.service";  // ← ADD
import { db } from "@test-evals/db";  // ← ADD
import { runs, caseResults } from "@test-evals/db";
import { eq } from "drizzle-orm";  // ← ADD

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/", (c) => {
  return c.text("OK");
});

// ─── EVAL ROUTES (add everything below) ───────────────────────

// POST /api/v1/runs — start a new eval run
app.post("/api/v1/runs", async (c) => {
  const body = await c.req.json();
  const { strategy, model = "claude-haiku-4-5-20251001", dataset_filter, force } = body;

  return streamSSE(c, async (stream) => {
    await runnerService.startRun(
      { strategy, model, dataset_filter, force },
      (event) => stream.writeSSE({ data: JSON.stringify(event) })
    );
  });
});

// POST /api/v1/runs/:id/resume — resume a crashed run
app.post("/api/v1/runs/:id/resume", async (c) => {
  const runId = c.req.param("id");
  return streamSSE(c, async (stream) => {
    await runnerService.resumeRun(
      runId,
      (event) => stream.writeSSE({ data: JSON.stringify(event) })
    );
  });
});

// GET /api/v1/runs — list all runs
app.get("/api/v1/runs", async (c) => {
  const allRuns = await db.select().from(runs).orderBy(runs.created_at);
  return c.json(allRuns);
});

// GET /api/v1/runs/:id — run detail with all case results
app.get("/api/v1/runs/:id", async (c) => {
  const runId = c.req.param("id");
  const run = await db.select().from(runs).where(eq(runs.id, runId));
  const cases = await db.select().from(caseResults).where(eq(caseResults.run_id, runId));
  if (!run[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ ...run[0], cases });
});

// GET /api/v1/compare?runA=...&runB=... — compare two runs
app.get("/api/v1/compare", async (c) => {
  const { runA, runB } = c.req.query();
  
  const [runAData, runBData] = await Promise.all([
    db.select().from(runs).where(eq(runs.id, runA)),
    db.select().from(runs).where(eq(runs.id, runB)),
  ]);
  const [casesA, casesB] = await Promise.all([
    db.select().from(caseResults).where(eq(caseResults.run_id, runA)),
    db.select().from(caseResults).where(eq(caseResults.run_id, runB)),
  ]);

  const fields = ["chief_complaint","vitals","medications","diagnoses","plan","follow_up","overall"];
  
  const deltas = fields.map(field => {
    const avgA = average(casesA.map(c => (c.scores as any)?.[field] ?? 0));
    const avgB = average(casesB.map(c => (c.scores as any)?.[field] ?? 0));
    return {
      field,
      runA: avgA,
      runB: avgB,
      delta: avgB - avgA,
      winner: Math.abs(avgB - avgA) < 0.01 ? "tie" : avgB > avgA ? "B" : "A"
    };
  });

  return c.json({
    runA: runAData[0],
    runB: runBData[0],
    deltas
  });
});

function average(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ─── END EVAL ROUTES ──────────────────────────────────────────

export default app;