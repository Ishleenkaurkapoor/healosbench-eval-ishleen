// apps/server/src/services/evaluate.service.ts
import type { ClinicalExtraction, FieldScores } from "@test-evals/shared";

// token-set ratio — install: bun add fuzzball
import { token_set_ratio } from "fuzzball";

export function evaluateCase(
  prediction: ClinicalExtraction,
  gold: ClinicalExtraction,
): FieldScores {
  const cc    = scoreChiefComplaint(prediction.chief_complaint, gold.chief_complaint);
  const vit   = scoreVitals(prediction.vitals, gold.vitals);
  const meds  = scoreMedications(prediction.medications, gold.medications);
  const dx    = scoreDiagnoses(prediction.diagnoses, gold.diagnoses);
  const plan  = scorePlan(prediction.plan, gold.plan);
  const fu    = scoreFollowUp(prediction.follow_up, gold.follow_up);
  const overall = (cc + vit + meds + dx + plan + fu) / 6;
  return { chief_complaint: cc, vitals: vit, medications: meds,
           diagnoses: dx, plan, follow_up: fu, overall };
}

function scoreChiefComplaint(pred: string, gold: string): number {
  return token_set_ratio(pred.toLowerCase(), gold.toLowerCase()) / 100;
}

function scoreVitals(pred: any, gold: any): number {
  const fields = ["bp","hr","temp_f","spo2"] as const;
  let hits = 0, total = 0;
  for (const f of fields) {
    if (gold[f] == null) continue;
    total++;
    if (f === "temp_f") hits += Math.abs((pred[f]??0) - gold[f]) <= 0.2 ? 1 : 0;
    else hits += pred[f] === gold[f] ? 1 : 0;
  }
  return total === 0 ? 1 : hits / total;
}

function scoreMedications(pred: any[], gold: any[]): number {
  const matched = new Set<number>();
  let tp = 0;
  for (const p of pred) {
    for (let i = 0; i < gold.length; i++) {
      if (matched.has(i)) continue;
      if (medicationsMatch(p, gold[i])) { tp++; matched.add(i); break; }
    }
  }
  return f1(pred.length ? tp/pred.length : 0, gold.length ? tp/gold.length : 0);
}

function scoreDiagnoses(pred: any[], gold: any[]): number {
  const matched = new Set<number>();
  let tp = 0;
  for (const p of pred) {
    for (let i = 0; i < gold.length; i++) {
      if (matched.has(i)) continue;
      if (token_set_ratio(p.description, gold[i].description) >= 75) {
        tp++; matched.add(i); break;
      }
    }
  }
  return f1(pred.length ? tp/pred.length : 0, gold.length ? tp/gold.length : 0);
}

function scorePlan(pred: string[], gold: string[]): number {
  const matched = new Set<number>();
  let tp = 0;
  for (const p of pred) {
    for (let i = 0; i < gold.length; i++) {
      if (matched.has(i)) continue;
      if (token_set_ratio(p.toLowerCase(), gold[i].toLowerCase()) >= 75) {
        tp++; matched.add(i); break;
      }
    }
  }
  return f1(pred.length ? tp/pred.length : 0, gold.length ? tp/gold.length : 0);
}

function scoreFollowUp(pred: any, gold: any): number {
  const days = pred?.interval_days === gold?.interval_days ? 1 : 0;
  const reason = token_set_ratio(pred?.reason ?? "", gold?.reason ?? "") / 100;
  return (days + reason) / 2;
}

function medicationsMatch(a: any, b: any): boolean {
  return token_set_ratio(a.name, b.name) >= 80
    && normalizeDose(a.dose) === normalizeDose(b.dose)
    && normalizeFreq(a.frequency) === normalizeFreq(b.frequency);
}

function normalizeFreq(f: string): string {
  return f.toLowerCase()
    .replace(/\bbid\b/,"twice daily").replace(/\btid\b/,"three times daily")
    .replace(/\bqd\b/,"once daily").trim();
}

function normalizeDose(d: string): string {
  return d.toLowerCase().replace(/\s+/g,"").replace("milligrams","mg");
}

function f1(precision: number, recall: number): number {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}