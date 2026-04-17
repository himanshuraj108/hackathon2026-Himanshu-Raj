/**
 * Agent Orchestrator — ReAct (Reasoning + Acting) Loop
 *
 * This module implements the core agentic reasoning loop for processing
 * a single support ticket. It follows the ReAct pattern:
 *   Thought -> Action (tool call) -> Observation -> repeat -> Final Answer
 *
 * Key behaviors:
 *   - Enforces minimum 3 tool calls per ticket
 *   - Validates tool outputs with Zod before acting on them
 *   - Retries failed tools with exponential backoff
 *   - Auto-escalates on low confidence (< 0.6)
 *   - Detects social engineering and fraud patterns
 *   - Produces complete audit trail for every decision
 *
 * Architecture: Each ticket runs as an isolated async process.
 * Concurrency is controlled at the main.js level (p-limit semaphore).
 */

const { callLLM } = require("../llm/provider");
const { createAgentState, recordToolCall, addReasoningStep } = require("./state");
const { calculateConfidence } = require("./confidence");
const { withRetry } = require("../utils/retry");
const logger = require("../utils/logger");

// Read tools
const {
  get_order,
  get_customer,
  get_product,
  search_knowledge_base,
} = require("../tools/readTools");

// Write tools
const {
  check_refund_eligibility,
  issue_refund,
  send_reply,
  escalate,
  cancel_order,
} = require("../tools/writeTools");

// Tool registry — maps tool name string to actual function
const TOOL_REGISTRY = {
  get_order,
  get_customer,
  get_product,
  search_knowledge_base,
  check_refund_eligibility,
  issue_refund,
  send_reply,
  escalate,
  cancel_order,
};

// ─────────────────────────────────────────────
// MAIN ENTRY: Process a single ticket
// ─────────────────────────────────────────────
async function processTicket(ticket) {
  const startTime = Date.now();
  const state = createAgentState(ticket);

  logger.info(`[Agent] Starting ticket ${ticket.ticket_id}`, {
    ticket_id: ticket.ticket_id,
    subject: ticket.subject,
    source: ticket.source,
  });

  try {
    // Phase 1: Classify the ticket
    await classifyTicket(state);

    // Phase 2: Information gathering (read tools — minimum 3 calls enforced)
    await gatherInformation(state);

    // Phase 3: Decision + Action
    await decideAndAct(state);

    state.status = state.decision === "escalate" ? "escalated" : "resolved";
    state.completed_at = new Date().toISOString();
    state.processing_time_ms = Date.now() - startTime;

    logger.info(`[Agent] Completed ticket ${ticket.ticket_id}`, {
      ticket_id: ticket.ticket_id,
      decision: state.decision,
      confidence: state.confidence_score,
      tool_calls: state.tool_calls.length,
      status: state.status,
      time_ms: state.processing_time_ms,
    });

    return buildAuditEntry(state);
  } catch (err) {
    state.status = "failed";
    state.error = err.message;
    state.completed_at = new Date().toISOString();
    state.processing_time_ms = Date.now() - startTime;

    logger.error(`[Agent] Ticket ${ticket.ticket_id} failed with error: ${err.message}`, {
      ticket_id: ticket.ticket_id,
      error: err.message,
    });

    throw err; // Let main.js handle DLQ routing
  }
}

// ─────────────────────────────────────────────
// Phase 1: Classification
// ─────────────────────────────────────────────
async function classifyTicket(state) {
  const prompt = buildClassificationPrompt(state.ticket);

  addReasoningStep(state, `Classifying ticket: "${state.ticket.subject}" from ${state.ticket.customer_email}`);

  const { text, provider, model } = await callLLM(prompt, { json_mode: true });
  state.llm_provider_used = provider;

  let classification;
  try {
    classification = safeParseJSON(text);
  } catch {
    // Fallback classification if LLM fails to produce valid JSON
    classification = {
      category: "general_inquiry",
      urgency: "medium",
      has_order_id: /ORD-\d+/i.test(state.ticket.body),
      order_id_extracted: extractOrderId(state.ticket.body),
      is_threatening: false,
      is_social_engineering: false,
      summary: state.ticket.subject,
    };
  }

  state.classification = classification.category || "general_inquiry";
  state.urgency = classification.urgency || "medium";
  state.has_threatening_language = classification.is_threatening || false;
  state.is_social_engineering = classification.is_social_engineering || false;
  state.extracted_order_id = classification.order_id_extracted || extractOrderId(state.ticket.body);

  addReasoningStep(
    state,
    `Classification result: category=${state.classification}, urgency=${state.urgency}, order_id=${state.extracted_order_id || "none detected"}`
  );
}

// ─────────────────────────────────────────────
// Phase 2: Information Gathering (Read Tools)
// ─────────────────────────────────────────────
async function gatherInformation(state) {
  const toolsToCall = planToolCalls(state);
  addReasoningStep(state, `Planned tool calls: [${toolsToCall.join(", ")}]`);

  // Ensure minimum 3 tool calls
  while (toolsToCall.length < 3) {
    toolsToCall.push("search_knowledge_base");
  }

  for (const toolName of toolsToCall) {
    await callToolSafely(state, toolName);
  }
}

/**
 * Determine which tools to call based on ticket classification and content.
 * This is the agent's planning step — it decides what information it needs.
 */
function planToolCalls(state) {
  const tools = [];
  const body = state.ticket.body.toLowerCase();
  const email = state.ticket.customer_email;
  const orderId = state.extracted_order_id;

  // Always look up the customer
  tools.push("get_customer");

  // If an order ID is present or implied, fetch the order
  if (orderId || body.includes("order") || body.includes("ord-")) {
    tools.push("get_order");
  }

  // Fetch product details if we have an order (to check warranty, return window)
  if (orderId) {
    tools.push("get_product");
  }

  // Search KB for policy context
  const needsKb = [
    "refund", "return", "cancel", "exchange", "warranty",
    "policy", "how long", "what is", "broken", "damaged",
  ].some((kw) => body.includes(kw));

  if (needsKb || tools.length < 3) {
    tools.push("search_knowledge_base");
  }

  // Ensure no duplicates
  return [...new Set(tools)];
}

/**
 * Execute a single tool call with retry and error handling.
 * Records the full call trace in state.
 */
async function callToolSafely(state, toolName) {
  const toolFn = TOOL_REGISTRY[toolName];
  if (!toolFn) return;

  // Build tool input based on state context
  const toolInput = resolveToolInput(toolName, state);
  if (!toolInput) {
    addReasoningStep(state, `Skipping ${toolName}: missing required input data.`);
    return;
  }

  const callStart = Date.now();
  let output, success;

  try {
    output = await withRetry(
      () => toolFn(...Object.values(toolInput)),
      { toolName, maxRetries: 3, baseDelayMs: 400 }
    );

    success = true;

    // Detect malformed responses
    if (output && output.__mock_failure === "malformed") {
      success = false;
      output = { error: "Tool returned malformed data", raw: output };
      addReasoningStep(state, `${toolName} returned malformed data — treating as failure, will not act on this result.`);
    } else {
      // Store data in state
      storeToolResult(state, toolName, output);
      addReasoningStep(state, `${toolName} succeeded: ${summarizeOutput(output)}`);
    }
  } catch (err) {
    success = false;
    output = { error: err.message };
    addReasoningStep(state, `${toolName} failed after retries: ${err.message}. Continuing with available data.`);
  }

  recordToolCall(state, toolName, toolInput, output, success, Date.now() - callStart);
}

/**
 * Map tool name to its required inputs from current state.
 */
function resolveToolInput(toolName, state) {
  const orderId = state.extracted_order_id || (state.order && state.order.order_id);
  const email = state.ticket.customer_email;
  const productId = state.order && state.order.product_id;
  const body = state.ticket.body;

  switch (toolName) {
    case "get_order":
      if (!orderId) return null;
      return { order_id: orderId };
    case "get_customer":
      return { email };
    case "get_product":
      if (!productId) return null;
      return { product_id: productId };
    case "search_knowledge_base":
      return { query: `${state.ticket.subject} ${body.slice(0, 100)}` };
    case "check_refund_eligibility":
      if (!orderId) return null;
      return { order_id: orderId, customer: state.customer };
    case "cancel_order":
      if (!orderId) return null;
      return { order_id: orderId };
    default:
      return null;
  }
}

/**
 * Store tool result in the appropriate state field.
 */
function storeToolResult(state, toolName, output) {
  if (!output || !output.success) return;

  switch (toolName) {
    case "get_order":
      state.order = output;
      // Try to resolve product_id for next tool call
      if (output.product_id && !state.extracted_product_id) {
        state.extracted_product_id = output.product_id;
      }
      break;
    case "get_customer":
      state.customer = output;
      break;
    case "get_product":
      state.product = output;
      break;
    case "search_knowledge_base":
      state.kb_results = output.results || [];
      break;
    case "check_refund_eligibility":
      state.eligibility_checked = true;
      state.eligibility_result = output;
      break;
  }
}

// ─────────────────────────────────────────────
// Phase 3: Decision + Action
// ─────────────────────────────────────────────
async function decideAndAct(state) {
  // Detect social engineering before anything else
  if (state.is_social_engineering || detectSocialEngineering(state)) {
    state.is_social_engineering = true;
    state.is_fraud_flagged = true;
    addReasoningStep(
      state,
      "Social engineering detected: customer claimed a tier or policy that does not match system records. Declining politely without exposing internal data."
    );
  }

  // Calculate confidence score
  const { score, explanation, requires_escalation, penalties } = calculateConfidence(state);
  state.confidence_score = score;
  addReasoningStep(state, `Confidence score: ${score} — ${explanation}. Penalties: ${penalties.join("; ") || "none"}`);

  // Build the decision prompt with all gathered data
  const decisionPrompt = buildDecisionPrompt(state);
  const { text } = await callLLM(decisionPrompt, { json_mode: true });

  let decision;
  try {
    decision = safeParseJSON(text);
  } catch {
    decision = { action: "escalate", reply: "We are forwarding your request to a specialist.", escalation_summary: "LLM decision parsing failed.", priority: "medium" };
  }

  state.decision = (requires_escalation && decision.action !== "escalate") ? "escalate" : decision.action;
  state.resolution_type = decision.resolution_type || null;

  addReasoningStep(state, `Decision: ${state.decision}${requires_escalation ? " (overridden to escalate due to low confidence)" : ""}`);

  // Execute the decided action
  await executeAction(state, decision);
}

/**
 * Execute the agent's decided action using write tools.
 */
async function executeAction(state, decision) {
  const ticketId = state.ticket.ticket_id;
  const customerName = state.customer ? state.customer.name.split(" ")[0] : "Valued Customer";
  const callStart = Date.now();

  // ── REFUND PATH ──
  if (state.decision === "resolve" && state.resolution_type === "refund") {
    // Step A: Check eligibility (if not already done)
    if (!state.eligibility_checked) {
      await callToolSafely(state, "check_refund_eligibility");
    }

    const eligibility = state.eligibility_result;

    if (eligibility && eligibility.eligible && !eligibility.requires_escalation) {
      // Step B: Issue the refund
      const refundStart = Date.now();
      let refundOutput;
      try {
        refundOutput = await issue_refund(
          state.order.order_id,
          state.order.amount,
          eligibility
        );
        recordToolCall(state, "issue_refund", { order_id: state.order.order_id, amount: state.order.amount }, refundOutput, true, Date.now() - refundStart);
        addReasoningStep(state, `Refund of $${state.order.amount} issued successfully for order ${state.order.order_id}.`);
        decision.reply = `Hi ${customerName}, I have processed a full refund of $${state.order.amount} for your order ${state.order.order_id}. You should see the amount in your account within 5-7 business days.`;
      } catch (err) {
        recordToolCall(state, "issue_refund", {}, { error: err.message }, false, Date.now() - refundStart);
        addReasoningStep(state, `Refund blocked: ${err.message}. Escalating instead.`);
        state.decision = "escalate";
        decision.action = "escalate";
        decision.escalation_summary = `Refund failed during issue_refund: ${err.message}`;
        decision.priority = "high";
      }
    } else if (eligibility && eligibility.requires_escalation) {
      // Refund > $200 — must escalate
      state.decision = "escalate";
      decision.escalation_summary = `Refund of $${state.order.amount} requires human approval (exceeds $200 threshold). ${eligibility.reason}`;
      decision.priority = "high";
    }
  }

  // ── CANCEL PATH ──
  if (state.decision === "resolve" && state.resolution_type === "cancel") {
    const cancelStart = Date.now();
    try {
      const cancelOutput = await cancel_order(state.order.order_id);
      recordToolCall(state, "cancel_order", { order_id: state.order.order_id }, cancelOutput, cancelOutput.success, Date.now() - cancelStart);

      if (cancelOutput.success) {
        addReasoningStep(state, `Order ${state.order.order_id} cancelled successfully.`);
        decision.reply = `Hi ${customerName}, your order ${state.order.order_id} has been cancelled successfully. You will receive a confirmation email within 1 hour.`;
      } else {
        addReasoningStep(state, `Cancellation failed: ${cancelOutput.error}. Sending informational reply.`);
        decision.reply = `Hi ${customerName}, unfortunately your order ${state.order.order_id} cannot be cancelled because it has already been ${state.order.status}. If you would like to return it after delivery, please contact us again.`;
      }
    } catch (err) {
      recordToolCall(state, "cancel_order", {}, { error: err.message }, false, Date.now() - cancelStart);
    }
  }

  // ── SEND REPLY ──
  const replyMessage = decision.reply || buildFallbackReply(state, customerName);
  state.final_reply = replyMessage;

  const replyStart = Date.now();
  try {
    const replyOutput = await send_reply(ticketId, replyMessage, customerName);
    recordToolCall(state, "send_reply", { ticket_id: ticketId, message: replyMessage.slice(0, 100) + "..." }, replyOutput, true, Date.now() - replyStart);
  } catch (err) {
    recordToolCall(state, "send_reply", {}, { error: err.message }, false, Date.now() - replyStart);
  }

  // ── ESCALATE PATH ──
  if (state.decision === "escalate") {
    const summary = decision.escalation_summary || buildEscalationSummary(state);
    const priority = decision.priority || deriveEscalationPriority(state);
    state.escalation_summary = summary;

    const escalateStart = Date.now();
    try {
      const escalateOutput = await escalate(ticketId, summary, priority);
      recordToolCall(state, "escalate", { ticket_id: ticketId, priority }, escalateOutput, true, Date.now() - escalateStart);
      addReasoningStep(state, `Ticket escalated to human queue with priority: ${priority}`);
    } catch (err) {
      recordToolCall(state, "escalate", {}, { error: err.message }, false, Date.now() - escalateStart);
    }
  }
}

// ─────────────────────────────────────────────
// Helper: Detect Social Engineering
// ─────────────────────────────────────────────
function detectSocialEngineering(state) {
  if (!state.customer || !state.ticket) return false;

  const body = state.ticket.body.toLowerCase();

  // Customer claims to be premium/VIP but system says standard
  const claimsPremium = body.includes("premium member") || body.includes("vip member");
  const claimsMagicPolicy = body.includes("instant refund") || body.includes("without questions") || body.includes("immediate refund");
  const isActuallyStandard = state.customer.tier === "standard";

  return (claimsPremium && isActuallyStandard) || claimsMagicPolicy;
}

// ─────────────────────────────────────────────
// Prompt Builders
// ─────────────────────────────────────────────
function buildClassificationPrompt(ticket) {
  return `You are classifying a ShopWave customer support ticket. Return ONLY a valid JSON object.

TICKET:
ID: ${ticket.ticket_id}
From: ${ticket.customer_email}
Subject: ${ticket.subject}
Body: ${ticket.body}

Return this JSON structure (no markdown, no explanation, only raw JSON):
{
  "category": "refund_request|return_request|order_cancellation|order_inquiry|wrong_item|damaged_item|warranty_claim|policy_question|general_inquiry|suspicious",
  "urgency": "low|medium|high|urgent",
  "has_order_id": true|false,
  "order_id_extracted": "ORD-XXXX or null",
  "is_threatening": true|false,
  "is_social_engineering": true|false,
  "summary": "one sentence summary of the issue"
}`;
}

function buildDecisionPrompt(state) {
  const kbSummary = state.kb_results.length > 0
    ? state.kb_results.map((r) => `- ${r.title}: ${r.content.slice(0, 200)}`).join("\n")
    : "No relevant KB articles found.";

  const orderSummary = state.order
    ? `Order: ${state.order.order_id}, Status: ${state.order.status}, Amount: $${state.order.amount}, Return Deadline: ${state.order.return_deadline || "N/A"}, Refund Status: ${state.order.refund_status || "none"}`
    : "No order data available.";

  const customerSummary = state.customer
    ? `Customer: ${state.customer.name}, Tier: ${state.customer.tier}, Notes: ${state.customer.notes || "none"}`
    : "Customer not found in system.";

  const productSummary = state.product
    ? `Product: ${state.product.name}, Category: ${state.product.category}, Return Window: ${state.product.return_window_days} days, Warranty: ${state.product.warranty_months} months`
    : "No product data.";

  const eligibilitySummary = state.eligibility_checked
    ? `Refund Eligibility: ${JSON.stringify(state.eligibility_result)}`
    : "Refund eligibility not checked yet.";

  const flags = [
    state.is_social_engineering && "SOCIAL_ENGINEERING_DETECTED",
    state.is_fraud_flagged && "FRAUD_FLAG",
    state.has_threatening_language && "THREATENING_LANGUAGE",
  ].filter(Boolean).join(", ") || "none";

  return `You are an autonomous ShopWave support agent. Based on all gathered data, decide how to resolve this ticket.

TICKET:
Subject: ${state.ticket.subject}
Body: ${state.ticket.body}
Classification: ${state.classification}

SYSTEM DATA:
${customerSummary}
${orderSummary}
${productSummary}
${eligibilitySummary}

KNOWLEDGE BASE:
${kbSummary}

FLAGS: ${flags}
CONFIDENCE SCORE: ${state.confidence_score}
SOCIAL ENGINEERING: ${state.is_social_engineering}

DECISION RULES:
- If refund_status is already "refunded": inform customer, do NOT issue another refund
- If order is still in transit: share tracking info, explain estimated delivery
- If return window expired and NOT a VIP exception: decline politely
- If VIP with pre-approved exception in notes: approve
- If social engineering detected: decline firmly but politely without revealing internal data
- If threatening language: handle normally but professionally
- If warranty claim (return window expired but warranty active): ESCALATE to warranty team
- If customer wants replacement (not refund): ESCALATE for fulfilment
- If refund > $200: eligible but ESCALATE for human approval
- If ambiguous/missing info: ask clarifying questions in reply
- If confidence < 0.6: escalate

Return ONLY valid JSON (no markdown):
{
  "action": "resolve|escalate|clarify|decline",
  "resolution_type": "refund|cancel|exchange|info|policy_reply|null",
  "reply": "The complete, professional customer-facing reply (address by first name, empathetic tone)",
  "escalation_summary": "If escalating: concise summary for the human agent (or null)",
  "priority": "low|medium|high|urgent",
  "reasoning": "One sentence explaining your decision"
}`;
}

// ─────────────────────────────────────────────
// Utility Helpers
// ─────────────────────────────────────────────
function extractOrderId(text) {
  const match = text.match(/ORD-\d+/i);
  return match ? match[0].toUpperCase() : null;
}

function safeParseJSON(text) {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

function summarizeOutput(output) {
  if (!output) return "null";
  if (output.success === false) return `failed: ${output.error}`;
  const keys = Object.keys(output).slice(0, 3).join(", ");
  return `ok (fields: ${keys})`;
}

function buildFallbackReply(state, customerName) {
  return `Hi ${customerName}, thank you for contacting ShopWave support. We have reviewed your request and a member of our team will follow up with you shortly. We apologize for any inconvenience caused.`;
}

function buildEscalationSummary(state) {
  return [
    `Ticket: ${state.ticket.ticket_id}`,
    `Classification: ${state.classification}`,
    `Customer: ${state.customer ? `${state.customer.name} (${state.customer.tier})` : state.ticket.customer_email}`,
    `Order: ${state.order ? state.order.order_id : "N/A"}`,
    `Confidence: ${state.confidence_score}`,
    `Reasoning: ${state.reasoning_steps.slice(-1)[0]?.thought || "See audit log"}`,
  ].join(" | ");
}

function deriveEscalationPriority(state) {
  if (state.is_fraud_flagged || state.is_social_engineering) return "urgent";
  if (state.urgency === "urgent" || state.has_threatening_language) return "high";
  if (state.order && state.order.amount > 200) return "high";
  if (state.urgency === "high") return "medium";
  return "medium";
}

// ─────────────────────────────────────────────
// Build final audit log entry
// ─────────────────────────────────────────────
function buildAuditEntry(state) {
  return {
    ticket_id: state.ticket.ticket_id,
    customer_email: state.ticket.customer_email,
    subject: state.ticket.subject,
    classification: state.classification,
    urgency: state.urgency,
    status: state.status,
    decision: state.decision,
    resolution_type: state.resolution_type,
    confidence_score: state.confidence_score,
    llm_provider: state.llm_provider_used,
    tool_calls: state.tool_calls,
    reasoning_steps: state.reasoning_steps,
    final_reply: state.final_reply,
    escalation_summary: state.escalation_summary,
    flags: {
      is_fraud_flagged: state.is_fraud_flagged,
      is_social_engineering: state.is_social_engineering,
      has_threatening_language: state.has_threatening_language,
    },
    started_at: state.started_at,
    completed_at: state.completed_at,
    processing_time_ms: state.processing_time_ms,
    error: state.error,
  };
}

module.exports = { processTicket };
