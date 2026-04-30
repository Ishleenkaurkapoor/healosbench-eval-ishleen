// packages/llm/src/strategies/zero_shot.ts
export function buildZeroShotMessages(transcript: string) {
  return {
    system: {
      text: `You are a clinical data extractor. Given a doctor-patient 
transcript, call extract_clinical_data with the structured data.
Normalize medication frequencies (BID→twice daily), 
extract all mentioned diagnoses with ICD-10 codes where possible.`,
      cache_control: { type: "ephemeral" }  // ← prompt caching!
    },
    user: transcript
  };
}

// packages/llm/src/strategies/few_shot.ts
// Same but prepend 2-3 example transcript→JSON pairs in the system prompt
// Mark examples with cache_control too

// packages/llm/src/strategies/cot.ts  
// Add "Think step by step: 1) identify chief complaint 2) scan for vitals..."