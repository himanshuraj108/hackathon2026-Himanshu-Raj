/**
 * Agent State Schema
 *
 * Defines the full state object that flows through the ReAct reasoning loop.
 * Each ticket gets its own isolated state instance — there is no shared mutable state
 * between concurrent ticket processors.
 */

/**
 * Create a fresh agent state for a new ticket.
 * @param {object} ticket - The support ticket to process
 * @returns {AgentState}
 */
function createAgentState(ticket) {
  return {
    // Input
    ticket,

    // Resolved data (populated by tool calls)
    customer: null,
    order: null,
    product: null,
    kb_results: [],

    // Reasoning trace (the heart of the audit log)
    tool_calls: [],          // Array of { tool, input, output, success, duration_ms, timestamp }
    reasoning_steps: [],     // Free-text reasoning at each step (LLM's internal monologue)
    observations: [],        // Summarized observations after each tool call

    // Decision
    classification: null,    // e.g. "refund_request", "order_inquiry", "wrong_item", "policy_question"
    urgency: null,           // "low" | "medium" | "high" | "urgent"
    confidence_score: 0,     // 0.0 to 1.0
    decision: null,          // "resolve" | "escalate" | "clarify" | "decline"
    resolution_type: null,   // "refund" | "cancel" | "exchange" | "info" | "policy_reply"

    // Outputs
    final_reply: null,       // The message sent to the customer
    escalation_summary: null,

    // Flags
    is_fraud_flagged: false,
    is_social_engineering: false,
    has_threatening_language: false,
    eligibility_checked: false,
    eligibility_result: null,

    // Meta
    started_at: new Date().toISOString(),
    completed_at: null,
    processing_time_ms: 0,
    llm_provider_used: null,
    status: "processing",    // "processing" | "resolved" | "escalated" | "failed" | "dlq"
    error: null,
  };
}

/**
 * Record a tool call in the agent state.
 * @param {AgentState} state
 * @param {string} toolName
 * @param {object} input
 * @param {object} output
 * @param {boolean} success
 * @param {number} durationMs
 */
function recordToolCall(state, toolName, input, output, success, durationMs) {
  state.tool_calls.push({
    tool: toolName,
    input,
    output,
    success,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Add a reasoning step to the state's trace.
 */
function addReasoningStep(state, step) {
  state.reasoning_steps.push({
    step: state.reasoning_steps.length + 1,
    thought: step,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { createAgentState, recordToolCall, addReasoningStep };
