// apps/server/src/cli/eval.ts
import { config } from "dotenv";
import { join } from "path";

// Load .env from apps/server/.env
config({ path: join(import.meta.dir, "../../../.env") });
import { parseArgs } from "util";
import { runnerService } from "../services/runner.service";
import { db } from "@test-evals/db";
import { caseResults } from "@test-evals/db";
import { eq } from "drizzle-orm";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    strategy: { type: "string", default: "zero_shot" },
    model: { type: "string", default: "claude-haiku-4-5-20251001" },
  }
});

console.log(`\nStarting eval: strategy=${values.strategy}\n`);

let completed = 0, failed = 0;

await runnerService.startRun(
  { strategy: values.strategy as any, model: values.model! },
  (event) => {
    if (event.type === "case_complete") { process.stdout.write("."); completed++; }
    if (event.type === "case_failed")   { 
      console.error(`\nFailed: ${event.transcript_id} — ${event.error}`); 
      failed++; 
    }
    if (event.type === "run_complete")  console.log("\n\nRun complete!");
}
);

// Print summary table
const cases = await db.select().from(caseResults);
const fields = ["chief_complaint","vitals","medications","diagnoses","plan","follow_up","overall"];
const agg: any = {};
for (const f of fields) {
  const vals = cases.map(c => (c.scores as any)?.[f] ?? 0);
  agg[f] = (vals.reduce((a:number,b:number)=>a+b,0)/vals.length).toFixed(3);
}

console.table(agg);
console.log(`Completed: ${completed} | Failed: ${failed}`);
process.exit(0);