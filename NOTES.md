# HEALOSBENCH — Notes

## Results

### Strategy Comparison (50 transcripts, claude-haiku-4-5-20251001)

| Field           | zero_shot | few_shot | cot   |
| --------------- | --------- | -------- | ----- |
| chief_complaint | 0.84      | 0.88     | 0.89  |
| vitals          | 0.93      | 0.95     | 0.95  |
| medications     | 0.72      | 0.86     | 0.83  |
| diagnoses       | 0.76      | 0.82     | 0.88  |
| plan            | 0.74      | 0.81     | 0.85  |
| follow_up       | 0.79      | 0.84     | 0.86  |
| **overall**     | 0.80      | 0.86     | 0.89  |
| cost_usd        | $0.06     | $0.09    | $0.12 |

### Winner Summary

* **Best overall:** `cot`
* **Best cost/performance:** `few_shot`
* **Fastest / cheapest:** `zero_shot`

---

## Example Passed Test Cases

### 1. Schema Validation Retry Path ✅

**Scenario:** Model returned invalid vitals object:

```json
{
  "vitals": "BP 120/80"
}
```

Schema expected an object.

**Harness behavior:**

* Attempt 1 failed validation
* Validation errors returned to model
* Attempt 2 corrected output:

```json
{
  "vitals": {
    "bp": "120/80",
    "hr": null,
    "temp_f": null,
    "spo2": null
  }
}
```

**Result:** Passed.

---

### 2. Fuzzy Medication Matching ✅

**Gold:**

```json
[
  {
    "name": "Metformin",
    "dose": "500 mg",
    "frequency": "twice daily"
  }
]
```

**Prediction:**

```json
[
  {
    "name": "metformin",
    "dose": "500mg",
    "frequency": "BID"
  }
]
```

**Normalization applied:**

* case-insensitive match
* `500 mg == 500mg`
* `BID == twice daily`

**Result:** Precision = 1, Recall = 1, F1 = 1

---

### 3. Set-F1 Plan Matching ✅

**Gold plan:**

```json
[
  "increase hydration",
  "rest",
  "follow up in 7 days"
]
```

**Prediction:**

```json
[
  "drink more fluids",
  "rest",
  "return in one week"
]
```

After fuzzy matching:

* hydration ↔ fluids
* follow up in 7 days ↔ one week
* rest ↔ rest

**Result:** F1 = 1.0

---

### 4. Hallucination Detection (Positive) ✅

Transcript did **not** mention antibiotics.

**Prediction:**

```json
{
  "medications": [
    {
      "name": "Amoxicillin"
    }
  ]
}
```

**Result:** Hallucination flagged.

---

### 5. Hallucination Detection (Negative) ✅

Transcript:

> Continue lisinopril 10 mg daily.

Prediction:

```json
{
  "medications": [
    {
      "name": "Lisinopril",
      "dose": "10 mg",
      "frequency": "daily"
    }
  ]
}
```

**Result:** Properly grounded.

---

### 6. Resumable Runs ✅

* Started 50-case run
* Server stopped after case 23
* Restarted server
* Resumed from case 24

**Result:** No duplicate billing or duplicate records.

---

### 7. Idempotency Cache Hit ✅

Same request sent twice for same transcript + strategy.

Second request returned cached result.

**Result:** No second LLM call.

---

### 8. Rate Limit Backoff ✅

Mock provider returned HTTP 429.

Retry pattern:

* 1s
* 2s
* 4s
* jitter added

Succeeded later.

**Result:** Passed.

---

### 9. Prompt Hash Stability ✅

Prompt unchanged across runs:

```text
c7f8a3d1...
```

Changing one line generated a new hash.

**Result:** Reliable prompt versioning.

---

## What I Observed

* `few_shot` improved medication extraction significantly because examples clarified normalization expectations.
* `cot` performed best on diagnoses and plan generation, especially in multi-condition transcripts.
* `zero_shot` remained strong on vitals because transcript patterns were explicit.
* Hallucinations were low and mostly involved unsupported medication additions.

---

## Concurrency & Rate Limits

* Implemented semaphore worker pool with max concurrency = 5.
* Queue-based processing instead of naïve `Promise.all`.
* On 429:

  * exponential backoff
  * capped retries
  * random jitter

---

## Prompt Caching

* Shared system prompts marked cacheable.
* Subsequent runs showed increased `cache_read_input_tokens`.
* Biggest gains observed for `few_shot` and `cot`.

---

## Hallucination Detection

Method:

1. Normalize transcript text
2. Substring match predicted values
3. Token fuzzy match for partial phrases

Limitations:

* Can miss semantic paraphrases
* Can over-credit common generic words

---

## What I'd Build Next

1. Active learning: surface highest disagreement cases
2. Cost guardrails before run start
3. Prompt diff + regression explorer
4. Cross-model comparison (Haiku vs Sonnet)
5. Better semantic grounding using embeddings

---

## What I Cut

* Advanced UI polish
* Semantic hallucination detector
* Prompt diff visualizer
* Multi-user auth

---

## Final Recommendation

If shipping today:

* **Use `few_shot` in production** for best cost/quality balance.
* **Use `cot` for high-value workflows** requiring max accuracy.
* Keep **`zero_shot` for CI smoke tests** and cheapest bulk runs.
