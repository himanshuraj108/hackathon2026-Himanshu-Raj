/**
 * Mock Failure Injection Module
 *
 * Simulates realistic production failure modes that any real service would experience:
 * 1. Timeout        - service takes too long to respond
 * 2. Malformed data - response structure is invalid / missing fields
 * 3. Service error  - upstream service throws a business logic error
 * 4. Partial data   - response is incomplete (some fields null/missing)
 *
 * Each tool has an independent failure probability seeded by order_id or email
 * to ensure deterministic failures during demo runs (same input = same failure).
 */

// Deterministic pseudo-random based on a string seed
function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash % 100) / 100;
}

/**
 * Simulates a network timeout.
 * @param {number} ms - Timeout duration in milliseconds
 */
async function simulateTimeout(ms = 8000) {
  await new Promise((_, reject) =>
    setTimeout(() => reject(new Error("ToolTimeoutError: Service did not respond within the allowed time.")), ms)
  );
}

/**
 * Returns a malformed response (missing required fields).
 */
function malformedResponse(partialData = {}) {
  return { status: "ok", data: null, ...partialData }; // data is null — agent must detect this
}

/**
 * Custom error class for refund service failures.
 */
class RefundServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "RefundServiceError";
    this.code = code;
  }
}

/**
 * Decide failure mode for a given tool call.
 * Uses deterministic seed so results are reproducible across runs.
 *
 * Failure rates (intentionally realistic, not extreme):
 *   - Timeout:    8% chance
 *   - Malformed:  5% chance
 *   - Partial:    7% chance
 *   (82% of calls succeed normally)
 *
 * Certain tool+input combinations are ALWAYS set to fail for demo purposes:
 *   - check_refund_eligibility on ORD-9999 -> RefundServiceError
 *   - get_order on ORD-9999               -> not found (handled in tool)
 */
function getFailureMode(toolName, inputKey) {
  // Hardcoded demo failures
  if (toolName === "check_refund_eligibility" && inputKey === "ORD-BADSERVICE") {
    return "service_error";
  }

  const rand = seededRandom(`${toolName}:${inputKey}`);

  if (rand < 0.08) return "timeout";
  if (rand < 0.13) return "malformed";
  if (rand < 0.20) return "partial";
  return "none";
}

module.exports = {
  simulateTimeout,
  malformedResponse,
  RefundServiceError,
  getFailureMode,
  seededRandom,
};
