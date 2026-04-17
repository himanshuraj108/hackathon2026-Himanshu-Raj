# Failure Mode Analysis

## ShopWave Autonomous Support Resolution Agent

This document describes at least five failure scenarios, the signals the system detects, and the specific recovery path taken in each case.

---

## Failure 1: Tool Timeout — Service Unresponsive

**Scenario:**
A call to `check_refund_eligibility(ORD-XXXX)` takes longer than the allowed threshold because the upstream refund service is slow or overloaded.

**How the system detects it:**
The tool execution is wrapped in a `simulateTimeout(6000)` which rejects the Promise after 6 seconds. The `withRetry` wrapper catches the `TimeoutError`.

**Recovery path:**
1. `withRetry` catches the `TimeoutError` after attempt 1.
2. Exponential backoff: waits `2^1 × 400ms = 800ms` (± jitter) before retry.
3. Retries up to 3 times total.
4. If all 3 fail: the tool call is marked `success: false` in the audit log, the agent proceeds with available data and escalates the ticket rather than taking a blind action.
5. If ticket itself fails: routed to `dead_letter_queue.json`.

**Code location:** `src/utils/retry.js`, `src/tools/mockFailures.js`

---

## Failure 2: Malformed Tool Response — Schema Invalid

**Scenario:**
`get_order("ORD-1003")` returns `{ status: "ok", data: null }` — the data field is null, meaning all downstream fields (`amount`, `return_deadline`, `product_id`) are missing.

**How the system detects it:**
After every tool call, the orchestrator checks for the `__mock_failure: "malformed"` marker or validates that `output.success === true` and required fields exist before storing to state.

**Recovery path:**
1. Malformed response detected → tool call logged as `success: false`.
2. State fields (`state.order`, `state.product`) remain null.
3. Confidence score is penalised for missing data.
4. If confidence drops below 0.6 → ticket is escalated to human queue with a note: "Unable to retrieve complete order data."
5. Agent never acts on null data — the safety check before `issue_refund` prevents any blind action.

**Code location:** `src/agent/orchestrator.js` → `callToolSafely()`, `src/agent/confidence.js`

---

## Failure 3: Non-Existent Order ID — Customer Provides Wrong Data

**Scenario:**
TKT-017: Customer provides `ORD-9999` which does not exist in the system. The customer also includes threatening language ("My lawyer will be in touch").

**How the system detects it:**
`get_order("ORD-9999")` returns `{ success: false, error: "Order ORD-9999 not found in the system." }`. The agent does not find order data in state.

**Recovery path:**
1. `state.order` remains null.
2. Threatening language detected during classification (`is_threatening: true`).
3. Agent cannot proceed without a valid order — decision becomes `clarify`.
4. Reply sent to customer: professional response asking for the correct order ID, no revealing of internal system details.
5. Threatening language flag is recorded in audit log but does not change the professional resolution path.

**Code location:** `src/tools/readTools.js` → `get_order()`, `src/agent/orchestrator.js` → `classifyTicket()`

---

## Failure 4: Social Engineering Attempt — Fake Tier Claim

**Scenario:**
TKT-018: Bob Mendes (standard tier) claims to be a "premium member" and demands an "instant refund without questions," citing a policy that does not exist.

**How the system detects it:**
1. `get_customer("bob.mendes@email.com")` returns `tier: "standard"`.
2. `detectSocialEngineering()` checks: customer body contains `"premium member"` + `"instant refund"` while system tier is `"standard"` → mismatch flagged.

**Recovery path:**
1. `state.is_social_engineering = true` and `state.is_fraud_flagged = true`.
2. Both flags apply maximum penalty to confidence score → score drops below 0.6.
3. Agent refuses to process refund request.
4. Professional reply sent explaining the actual policy without revealing that fraud was detected.
5. Ticket escalated to human queue with `priority: "urgent"` and full context.
6. Audit entry records both flags for security review.

**Code location:** `src/agent/orchestrator.js` → `detectSocialEngineering()`, `src/agent/confidence.js`

---

## Failure 5: RefundService Throws Internal Error

**Scenario:**
`check_refund_eligibility` throws a `RefundServiceError` with code `MALFORMED_UPSTREAM` — indicating the refund microservice itself returned corrupt data.

**How the system detects it:**
The `RefundServiceError` is a named custom error class. `withRetry` catches it, retries 3 times. If all retries fail, the outer `try/catch` in `executeAction` catches it.

**Recovery path:**
1. `issue_refund` is NOT called — the safety guard requires a successful eligibility result.
2. Agent logs the exception as a tool failure.
3. Decision is overridden to `escalate`.
4. Escalation summary includes: "Refund eligibility check failed due to upstream service error. Amount: $X. Manual verification required."
5. Priority set to `high`.
6. Customer receives: "We are reviewing your request and a specialist will follow up shortly."

**Code location:** `src/tools/mockFailures.js` → `RefundServiceError`, `src/tools/writeTools.js` → `check_refund_eligibility()`

---

## Failure 6: LLM Provider Failure — All Providers Unreachable

**Scenario:**
Groq API returns a 503 and Gemini also fails (rate limit). Both LLM providers fail.

**How the system detects it:**
`callLLM()` iterates through all registered providers. After all throw, it throws a combined error: `"All LLM providers failed. Errors: groq: 503 | gemini: 429"`.

**Recovery path:**
1. `processTicket()` catches the error.
2. Ticket routed to `dead_letter_queue.json` via `pushToDLQ()`.
3. Full context preserved: ticket data, reasoning steps completed so far, error message.
4. Audit log entry marked `status: "dlq"`.
5. Dashboard DLQ page surfaces the entry for human review.

**Code location:** `src/llm/provider.js`, `main.js` → concurrent task error handler
 
 ---

 ## Failure 7: LLM Rate Limits & API Key Exhaustion
 
 **Scenario:**
 Groq Free Tier limits tokens per day (TPD) to 100,000. During high concurrency, the application instantly exhausts a single key.
 
 **How the system detects it:**
 The Groq SDK throws an Error with `status: 429` (Rate Limited).
 
 **Recovery path:**
 1. **Strict Load Balancing:** To prevent this proactively, `groq.js` uses a global counter to perfectly distribute tickets across 4 provided Groq API keys in a strict Round-Robin format (25% load each).
 2. **Sequential Fallback:** If a specific key still hits a limit (Error 429), the provider immediately iterates to the next available Groq key.
 3. **Cross-Provider Fallback:** If all 4 Groq keys fail, the `provider.js` layer catches the error and seamlessly falls back to the Gemini Provider.
 4. **Deep Backup:** The Gemini Provider itself has 2 fallback keys across 2 separate models (`gemini-1.5-flash` and `gemini-2.0-flash`).
 
 Providing a massive 6-layer LLM safety net before a ticket ever hits the DLQ.
 
 **Code location:** `src/llm/groq.js`, `src/llm/gemini.js`
