import { pgTable, text, jsonb, integer, real, 
         timestamp, boolean } from "drizzle-orm/pg-core";

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  strategy: text("strategy").notNull(),
  model: text("model").notNull(),
  prompt_hash: text("prompt_hash").notNull(),
  status: text("status").notNull().default("pending"),
  created_at: timestamp("created_at").defaultNow(),
  completed_at: timestamp("completed_at"),
  aggregate_scores: jsonb("aggregate_scores"),
  total_tokens: jsonb("total_tokens"),
  total_cost_usd: real("total_cost_usd"),
});

export const caseResults = pgTable("case_results", {
  id: text("id").primaryKey(),
  run_id: text("run_id").references(() => runs.id),
  transcript_id: text("transcript_id").notNull(),
  status: text("status").notNull().default("pending"),
  prediction: jsonb("prediction"),
  scores: jsonb("scores"),
  attempts: jsonb("attempts"),
  hallucinations: jsonb("hallucinations"),
  schema_valid: boolean("schema_valid"),
  tokens: jsonb("tokens"),
  wall_time_ms: integer("wall_time_ms"),
});