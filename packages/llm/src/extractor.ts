import Anthropic from "@anthropic-ai/sdk";
// Use ajv-formats + draft 2020-12 support
import Ajv2020 from "ajv/dist/2020";

import { createHash } from "crypto";
import { extractionTool } from "./tool";
import { withBackoff } from "./backoff";
import { buildFewShotMessages } from "./strategies/few_shot";
import { buildCoTMessages } from "./strategies/cot";
import type { ClinicalExtraction, PromptStrategy, TokenUsage } from "@test-evals/shared";

// bun add ajv — then import schema
import schema from "../../../data/schema.json";

const client = new Anthropic();
const ajv = new Ajv2020();
const validate = ajv.compile(schema);

export interface AttemptLog {
  attempt: number;
  systemPrompt: string;
  userMessage: string;
  response: any;
  validationErrors?: string[];
}

export interface ExtractionResult {
  result: ClinicalExtraction | null;
  attempts: AttemptLog[];
  usage: TokenUsage;
  schemaValid: boolean;
  promptHash: string;
}

// Hash the prompt so every run is pinned to a prompt version
export function hashPrompt(strategy: PromptStrategy, systemPrompt: string): string {
  return createHash("sha256")
    .update(`${strategy}::${systemPrompt}`)
    .digest("hex")
    .slice(0, 16);
}

function getSystemPrompt(strategy: PromptStrategy, transcript: string) {
  if (strategy === "few_shot") return buildFewShotMessages(transcript);
  if (strategy === "cot")      return buildCoTMessages(transcript);
  // zero_shot
  return {
    systemPrompt: `You are a clinical data extractor. Given a doctor-patient transcript, 
call extract_clinical_data with the structured data. 
Normalize medication frequencies (BID→twice daily, TID→three times daily, QD→once daily).
Extract all diagnoses with ICD-10 codes where inferable. Set vitals to null if not mentioned.`,
    userMessage: transcript
  };
}
// Simple schema validation — no AJV needed
function validateExtraction(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof data.chief_complaint !== "string")
    errors.push("chief_complaint must be a string");
  
  if (!data.vitals || typeof data.vitals !== "object")
    errors.push("vitals must be an object");
  
  if (!Array.isArray(data.medications))
    errors.push("medications must be an array");
  
  if (!Array.isArray(data.diagnoses))
    errors.push("diagnoses must be an array");
  
  if (!Array.isArray(data.plan))
    errors.push("plan must be an array");
  
  if (!data.follow_up || typeof data.follow_up !== "object")
    errors.push("follow_up must be an object");

  return { valid: errors.length === 0, errors };
}

export async function extractWithRetry(
  transcript: string,
  strategy: PromptStrategy,
  maxAttempts = 3
): Promise<ExtractionResult> {
  const { systemPrompt, userMessage } = getSystemPrompt(strategy, transcript);
  const promptHash = hashPrompt(strategy, systemPrompt);

  const attempts: AttemptLog[] = [];
  let totalUsage: TokenUsage = { input: 0, output: 0, cache_read: 0, cache_write: 0, cost_usd: 0 };
  let messages: Anthropic.MessageParam[] = [];
  let lastValidationErrors: string[] = [];

  for (let i = 0; i < maxAttempts; i++) {
    // Build messages — on retry, add error feedback
    if (i === 0) {
      messages = [{ role: "user", content: userMessage }];
    } else {
      messages = [
        ...messages,
        // append the last bad assistant response
        { role: "assistant", content: attempts[i-1].response.content },
        // ask it to fix
        { role: "user", content: `Validation failed with these errors:\n${lastValidationErrors.join("\n")}\nPlease call the tool again with corrected values.` }
      ];
    }

    const response = await withBackoff(() =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: systemPrompt,
            // prompt caching — only on first attempt
            ...(i === 0 ? { cache_control: { type: "ephemeral" } } : {})
          }
        ],
        tools: [extractionTool],
        tool_choice: { type: "auto" },
        messages,
      })
    );

    // Accumulate token usage
    const u = response.usage as any;
    totalUsage.input      += u.input_tokens ?? 0;
    totalUsage.output     += u.output_tokens ?? 0;
    totalUsage.cache_read += u.cache_read_input_tokens ?? 0;
    totalUsage.cache_write+= u.cache_creation_input_tokens ?? 0;

    const toolUse = response.content.find(b => b.type === "tool_use");
    const attemptLog: AttemptLog = {
      attempt: i + 1,
      systemPrompt,
      userMessage,
      response,
    };

    if (!toolUse) {
      lastValidationErrors = ["Model did not call the tool"];
      attemptLog.validationErrors = lastValidationErrors;
      attempts.push(attemptLog);
      continue;
    }

    const extracted = (toolUse as any).input as ClinicalExtraction;
   const { valid, errors } = validateExtraction(extracted);
    if (!valid) {
    lastValidationErrors = errors;
    attemptLog.validationErrors = errors;
    attempts.push(attemptLog);
    continue;
}

    attempts.push(attemptLog);
    totalUsage.cost_usd = calculateCost(totalUsage);

    return { result: extracted, attempts, usage: totalUsage, schemaValid: true, promptHash };
  }

  totalUsage.cost_usd = calculateCost(totalUsage);
  return { result: null, attempts, usage: totalUsage, schemaValid: false, promptHash };
}

function calculateCost(usage: Omit<TokenUsage, "cost_usd">): number {
  // Haiku 4.5 pricing (per million tokens)
  const INPUT_COST  = 0.80 / 1_000_000;
  const OUTPUT_COST = 4.00 / 1_000_000;
  const CACHE_READ  = 0.08 / 1_000_000;
  const CACHE_WRITE = 1.00 / 1_000_000;
  return (
    usage.input       * INPUT_COST  +
    usage.output      * OUTPUT_COST +
    usage.cache_read  * CACHE_READ  +
    usage.cache_write * CACHE_WRITE
  );
}