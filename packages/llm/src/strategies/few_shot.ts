import type { PromptStrategy } from "@test-evals/shared";

export function buildFewShotMessages(transcript: string) {
  const systemPrompt = `You are a clinical data extractor.

EXAMPLE 1:
Transcript: "Patient presents with chest pain. BP 140/90, HR 88. Taking lisinopril 10mg once daily. Diagnosis: hypertension (I10). Plan: continue meds, reduce sodium. Follow up in 30 days."
Output: call extract_clinical_data with chief_complaint="chest pain", vitals={bp:"140/90",hr:88,temp_f:null,spo2:null}, medications=[{name:"lisinopril",dose:"10mg",frequency:"once daily",route:"oral"}], diagnoses=[{description:"hypertension",icd10:"I10"}], plan=["continue meds","reduce sodium"], follow_up={interval_days:30,reason:"blood pressure check"}

EXAMPLE 2:
Transcript: "Fever and cough x3 days. Temp 101.2F, SpO2 97%. Prescribed amoxicillin 500mg TID. Likely URI. Rest and fluids. Return if worse."
Output: call extract_clinical_data with chief_complaint="fever and cough", vitals={bp:null,hr:null,temp_f:101.2,spo2:97}, medications=[{name:"amoxicillin",dose:"500mg",frequency:"three times daily",route:"oral"}], diagnoses=[{description:"upper respiratory infection"}], plan=["rest","increase fluid intake"], follow_up={interval_days:null,reason:"return if symptoms worsen"}

Now extract from the transcript below. Normalize all frequencies (BID→twice daily etc).`;

  return { systemPrompt, userMessage: transcript };
}