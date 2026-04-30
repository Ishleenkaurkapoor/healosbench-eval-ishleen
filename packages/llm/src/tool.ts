// packages/llm/src/tool.ts
import Anthropic from "@anthropic-ai/sdk";

export const extractionTool: Anthropic.Tool = {
  name: "extract_clinical_data",
  description: "Extract structured clinical data from a transcript",
  input_schema: {
    type: "object",
    // paste the full schema.json content here
    properties: { /* ... from schema.json */ },
    required: ["chief_complaint", "vitals", "medications", 
               "diagnoses", "plan", "follow_up"]
  }
};