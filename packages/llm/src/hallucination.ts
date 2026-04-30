// packages/llm/src/hallucination.ts
import type { ClinicalExtraction } from "@test-evals/shared";

export function detectHallucinations(
  prediction: ClinicalExtraction,
  transcript: string
): string[] {
  const hallucinated: string[] = [];
  const t = transcript.toLowerCase();

  for (const med of prediction.medications) {
    if (!isGrounded(med.name, t)) {
      hallucinated.push(`medication: ${med.name}`);
    }
  }

  for (const dx of prediction.diagnoses) {
    if (!isGrounded(dx.description, t)) {
      hallucinated.push(`diagnosis: ${dx.description}`);
    }
  }

  return hallucinated;
}

function isGrounded(value: string, transcript: string): boolean {
  const v = value.toLowerCase();
  if (transcript.includes(v)) return true;
  const words = v.split(/\s+/).filter(w => w.length > 3);
  return words.some(word => transcript.includes(word));
}