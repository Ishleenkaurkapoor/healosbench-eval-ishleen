export function buildCoTMessages(transcript: string) {
  const systemPrompt = `You are a clinical data extractor. Think step by step before calling the tool:

Step 1 — Chief complaint: What is the primary reason for the visit? (first sentence / patient's own words)
Step 2 — Vitals: Scan for BP (XXX/XX), HR (beats/min), temperature (°F), SpO2 (%). Set null if not mentioned.
Step 3 — Medications: List every drug with dose, frequency (normalize: BID→twice daily), route.
Step 4 — Diagnoses: List confirmed/suspected conditions. Add ICD-10 code if inferable.
Step 5 — Plan: List each action item as a separate string.
Step 6 — Follow-up: Extract interval in days and reason. Null if not stated.

After reasoning through each step, call extract_clinical_data with your answers.`;

  return { systemPrompt, userMessage: transcript };
}