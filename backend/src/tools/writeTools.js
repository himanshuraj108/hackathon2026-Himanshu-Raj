/**
 * WRITE TOOLS
 *
 * These tools perform state-changing operations.
 * They are called only after read tools have confirmed eligibility.
 *
 * Critical safety rules enforced in code:
 *   - issue_refund  -> MUST have a passing check_refund_eligibility result first
 *   - escalate      -> Always succeeds (safe fallback action)
 *   - send_reply    -> Always succeeds (logging only in mock)
 *
 * Tools:
 *   5. check_refund_eligibility(order_id)      - complex logic, can throw RefundServiceError
 *   6. issue_refund(order_id, amount, context) - irreversible; validated before call
 *   7. send_reply(ticket_id, message)          - sends customer-facing reply
 *   8. escalate(ticket_id, summary, priority)  - routes to human with full context
 */

const fs = require("fs");
const path = require("path");
const { simulateTimeout, RefundServiceError, getFailureMode } = require("./mockFailures");
const logger = require("../utils/logger");

const orders = require("../data/orders.json");
const ordersMap = Object.fromEntries(orders.map((o) => [o.order_id, o]));

// In-memory state for issued refunds and escalations (persisted to audit log)
const issuedRefunds = new Map();
const sentReplies = [];
const escalations = [];
const cancelledOrders = new Set();

// ─────────────────────────────────────────────
// Tool 5: check_refund_eligibility
// ─────────────────────────────────────────────
async function check_refund_eligibility(order_id, customer = null) {
  logger.info(`[Tool] check_refund_eligibility called`, { order_id });

  const failureMode = getFailureMode("check_refund_eligibility", order_id);

  // Deliberate service error for demo (shows agent can handle upstream failures)
  if (failureMode === "timeout") {
    await simulateTimeout(6000);
  }

  if (failureMode === "malformed") {
    throw new RefundServiceError(
      "RefundService upstream returned malformed eligibility data. Cannot determine eligibility.",
      "MALFORMED_UPSTREAM"
    );
  }

  const order = ordersMap[order_id];

  if (!order) {
    return {
      success: false,
      eligible: false,
      reason: `Order ${order_id} does not exist in the system.`,
      order_id,
    };
  }

  // Already refunded
  if (order.refund_status === "refunded" || issuedRefunds.has(order_id)) {
    return {
      success: true,
      eligible: false,
      reason: "A refund has already been processed for this order.",
      order_id,
      existing_refund: true,
    };
  }

  // Order not yet delivered
  if (order.status === "processing" || order.status === "shipped") {
    return {
      success: true,
      eligible: false,
      reason: `Order is currently in '${order.status}' status. Refunds can only be processed after delivery.`,
      order_id,
      suggestion: "Customer may be able to cancel the order instead.",
    };
  }

  // Check return deadline
  const today = new Date("2024-03-22"); // Fixed for deterministic demo
  const returnDeadline = order.return_deadline ? new Date(order.return_deadline) : null;

  // VIP exception override
  const isVip = customer && customer.tier === "vip";
  const hasVipException =
    isVip && customer.notes && customer.notes.toLowerCase().includes("pre-approved");

  if (returnDeadline && today > returnDeadline && !hasVipException) {
    return {
      success: true,
      eligible: false,
      reason: `Return window expired on ${order.return_deadline}. The item is no longer eligible for a refund.`,
      order_id,
      expired: true,
    };
  }

  // Refund > $200 should be escalated (per KB guidelines)
  if (order.amount > 200) {
    return {
      success: true,
      eligible: true,
      requires_escalation: true,
      reason: `Refund amount of $${order.amount} exceeds $200 threshold. Eligible but requires human review before processing.`,
      order_id,
      amount: order.amount,
    };
  }

  return {
    success: true,
    eligible: true,
    reason: "Order is within return window and meets all refund criteria.",
    order_id,
    amount: order.amount,
    requires_escalation: false,
  };
}

// ─────────────────────────────────────────────
// Tool 6: issue_refund  (IRREVERSIBLE)
// ─────────────────────────────────────────────
async function issue_refund(order_id, amount, eligibility_result) {
  logger.info(`[Tool] issue_refund called`, { order_id, amount });

  // Hard safety check — must have eligibility confirmation passed in
  if (!eligibility_result || !eligibility_result.eligible) {
    throw new Error(
      "SafetyViolation: issue_refund called without confirmed eligibility. This action is blocked."
    );
  }

  if (eligibility_result.requires_escalation) {
    throw new Error(
      "SafetyViolation: This refund requires human escalation before processing. Use escalate() instead."
    );
  }

  if (issuedRefunds.has(order_id)) {
    return {
      success: false,
      reason: `Refund for ${order_id} was already issued in this session.`,
      idempotent: true,
    };
  }

  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 200));

  const refundRecord = {
    order_id,
    amount,
    refund_id: `REF-${order_id}-${Date.now()}`,
    processed_at: new Date().toISOString(),
    status: "processed",
    estimated_bank_arrival: "5-7 business days",
  };

  issuedRefunds.set(order_id, refundRecord);

  logger.info(`[Tool] Refund issued successfully`, refundRecord);

  return { success: true, ...refundRecord };
}

// ─────────────────────────────────────────────
// Tool 7: send_reply
// ─────────────────────────────────────────────
async function send_reply(ticket_id, message, customer_name = null) {
  logger.info(`[Tool] send_reply called`, { ticket_id });

  const reply = {
    ticket_id,
    message,
    to_customer: customer_name,
    sent_at: new Date().toISOString(),
    channel: "email",
    status: "sent",
  };

  sentReplies.push(reply);

  logger.info(`[Tool] Reply sent to customer`, { ticket_id, preview: message.slice(0, 80) });

  return { success: true, ...reply };
}

// ─────────────────────────────────────────────
// Tool 8: escalate
// ─────────────────────────────────────────────
async function escalate(ticket_id, summary, priority = "medium") {
  logger.info(`[Tool] escalate called`, { ticket_id, priority });

  const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
  const safePriority = VALID_PRIORITIES.includes(priority) ? priority : "medium";

  const escalation = {
    ticket_id,
    summary,
    priority: safePriority,
    escalated_at: new Date().toISOString(),
    assigned_to: "human_support_queue",
    status: "escalated",
    estimated_response: safePriority === "urgent" ? "1 hour" : "4 hours",
  };

  escalations.push(escalation);

  logger.info(`[Tool] Ticket escalated to human queue`, { ticket_id, priority: safePriority });

  return { success: true, ...escalation };
}

// ─────────────────────────────────────────────
// Tool: cancel_order (bonus — used for TKT-006, TKT-012)
// ─────────────────────────────────────────────
async function cancel_order(order_id) {
  logger.info(`[Tool] cancel_order called`, { order_id });

  const order = ordersMap[order_id];

  if (!order) {
    return { success: false, error: `Order ${order_id} not found.` };
  }

  if (order.status !== "processing") {
    return {
      success: false,
      error: `Cannot cancel order in '${order.status}' status. Only processing orders can be cancelled.`,
      order_id,
      current_status: order.status,
    };
  }

  if (cancelledOrders.has(order_id)) {
    return { success: true, order_id, status: "already_cancelled", idempotent: true };
  }

  cancelledOrders.add(order_id);

  logger.info(`[Tool] Order cancelled successfully`, { order_id });

  return {
    success: true,
    order_id,
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    confirmation: "Cancellation confirmation will be sent via email within 1 hour.",
  };
}

// Export state for audit log generation
function getWriteToolState() {
  return {
    issued_refunds: Array.from(issuedRefunds.values()),
    sent_replies: sentReplies,
    escalations,
    cancelled_orders: Array.from(cancelledOrders),
  };
}

module.exports = {
  check_refund_eligibility,
  issue_refund,
  send_reply,
  escalate,
  cancel_order,
  getWriteToolState,
};
