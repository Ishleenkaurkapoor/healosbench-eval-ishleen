// packages/shared/src/types.ts

export interface Vitals {
  bp: string | null;
  hr: number | null;
  temp_f: number | null;
  spo2: number | null;
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  route: string;
}

export interface Diagnosis {
  description: string;
  icd10?: string;
}

export interface FollowUp {
  interval_days: number | null;
  reason: string | null;
}

export interface ClinicalExtraction {
  chief_complaint: string;
  vitals: Vitals;
  medications: Medication[];
  diagnoses: Diagnosis[];
  plan: string[];
  follow_up: FollowUp;
}

// Run DTOs
export type PromptStrategy = "zero_shot" | "few_shot" | "cot";

export interface RunRequest {
  strategy: PromptStrategy;
  model: string;
  dataset_filter?: string[];
  force?: boolean;
}

export interface CaseResult {
  transcript_id: string;
  prediction: ClinicalExtraction | null;
  scores: FieldScores;
  attempts: number;
  schema_valid: boolean;
  hallucination_count: number;
  tokens: TokenUsage;
  wall_time_ms: number;
}

export interface FieldScores {
  chief_complaint: number;
  vitals: number;
  medications: number;   // F1
  diagnoses: number;     // F1
  plan: number;          // F1
  follow_up: number;
  overall: number;
}

export interface TokenUsage {
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
  cost_usd: number;
}