// apps/server/src/services/runner.service.ts
import { db } from "@test-evals/db";
import { runs, caseResults } from "@test-evals/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { extractWithRetry } from "@test-evals/llm";
import { evaluateCase } from "./evaluate.service";
import { detectHallucinations } from "@test-evals/llm/hallucination";
import type { RunRequest } from "@test-evals/shared";

const DATA_DIR = join(import.meta.dir, "../../../../data");
const CONCURRENCY = 5;

export const runnerService = {
  async startRun(req: RunRequest, onEvent: (e: any) => void) {
    const runId = randomUUID();

    await db.insert(runs).values({
      id: runId,
      strategy: req.strategy,
      model: req.model ?? "claude-haiku-4-5-20251001",
      prompt_hash: "pending",
      status: "running",
    });

    const transcriptFiles = await readdir(join(DATA_DIR, "transcripts"));
    const filtered = req.dataset_filter
      ? transcriptFiles.filter(f =>
          req.dataset_filter!.includes(f.replace(".txt", ""))
        )
      : transcriptFiles;

    for (const file of filtered) {
      await db.insert(caseResults).values({
        id: randomUUID(),
        run_id: runId,
        transcript_id: file.replace(".txt", ""),
        status: "pending",
      }).onConflictDoNothing();
    }

    await processQueue(runId, req, filtered, onEvent);

    const allCases = await db.select()
      .from(caseResults)
      .where(eq(caseResults.run_id, runId));

    const fields = ["chief_complaint","vitals","medications",
                    "diagnoses","plan","follow_up","overall"];
    const aggregate: any = {};
    for (const f of fields) {
      const vals = allCases
        .filter(c => c.scores)
        .map(c => (c.scores as any)[f] ?? 0);
      aggregate[f] = vals.length
        ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length
        : 0;
    }

    const totalTokens = allCases.reduce((acc, c) => {
      const t = c.tokens as any;
      if (!t) return acc;
      return {
        input:       acc.input       + (t.input ?? 0),
        output:      acc.output      + (t.output ?? 0),
        cache_read:  acc.cache_read  + (t.cache_read ?? 0),
        cache_write: acc.cache_write + (t.cache_write ?? 0),
        cost_usd:    acc.cost_usd    + (t.cost_usd ?? 0),
      };
    }, { input: 0, output: 0, cache_read: 0, cache_write: 0, cost_usd: 0 });

    await db.update(runs)
      .set({
        status: "done",
        completed_at: new Date(),
        aggregate_scores: aggregate,
        total_tokens: totalTokens,
        total_cost_usd: totalTokens.cost_usd,
      })
      .where(eq(runs.id, runId));

    onEvent({ type: "run_complete", run_id: runId, aggregate, totalTokens });
  },

  async resumeRun(runId: string, onEvent: (e: any) => void) {
    const run = await db.select().from(runs).where(eq(runs.id, runId));
    if (!run[0]) throw new Error("Run not found");

    const req = { strategy: run[0].strategy as any, model: run[0].model };

    const pending = await db.select()
      .from(caseResults)
      .where(and(
        eq(caseResults.run_id, runId),
        eq(caseResults.status, "pending")
      ));

    const files = pending.map(c => c.transcript_id + ".txt");
    await processQueue(runId, req, files, onEvent);
    onEvent({ type: "run_complete", run_id: runId });
  }
};

async function processQueue(
  runId: string,
  req: any,
  files: string[],
  onEvent: (e: any) => void
) {
  const queue = [...files];

  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift()!;
      const transcriptId = file.replace(".txt", "");

      const existing = await db.select()
        .from(caseResults)
        .where(and(
          eq(caseResults.run_id, runId),
          eq(caseResults.transcript_id, transcriptId)
        ));

      if (existing[0]?.status === "done" && !req.force) {
        onEvent({ type: "case_skipped", transcript_id: transcriptId });
        continue;
      }

      const start = Date.now();
      try {
        const transcript = await readFile(
          join(DATA_DIR, "transcripts", file), "utf-8"
        );
        const gold = JSON.parse(
          await readFile(
            join(DATA_DIR, "gold", `${transcriptId}.json`), "utf-8"
          )
        );

        const extraction = await extractWithRetry(transcript, req.strategy);
        const scores = extraction.result
          ? evaluateCase(extraction.result, gold)
          : null;
        const hallucinations = extraction.result
          ? detectHallucinations(extraction.result, transcript)
          : [];

        await db.update(caseResults)
          .set({
            status: "done",
            prediction: extraction.result as any,
            scores: scores as any,
            attempts: extraction.attempts as any,
            hallucinations: hallucinations as any,
            schema_valid: extraction.schemaValid,
            tokens: extraction.usage as any,
            wall_time_ms: Date.now() - start,
          })
          .where(and(
            eq(caseResults.run_id, runId),
            eq(caseResults.transcript_id, transcriptId)
          ));

        onEvent({ type: "case_complete", transcript_id: transcriptId, scores });
      } catch (err: any) {
        await db.update(caseResults)
          .set({ status: "failed" })
          .where(and(
            eq(caseResults.run_id, runId),
            eq(caseResults.transcript_id, transcriptId)
          ));
        onEvent({ type: "case_failed", transcript_id: transcriptId, error: err.message });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}