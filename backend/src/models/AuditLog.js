const mongoose = require("mongoose");

/**
 * AuditLog — Stores the complete reasoning trace for every processed ticket.
 * This is the primary evidence of agent behavior for the hackathon judges.
 */
const auditLogSchema = new mongoose.Schema(
  {
    ticket_id: { type: String, required: true, unique: true, index: true },
    customer_email: { type: String, required: true },
    subject: { type: String },
    classification: { type: String },
    urgency: { type: String, enum: ["low", "medium", "high", "urgent"] },
    status: { type: String, enum: ["processing", "resolved", "escalated", "failed", "dlq"] },
    decision: { type: String, enum: ["resolve", "escalate", "clarify", "decline"] },
    resolution_type: { type: String },
    confidence_score: { type: Number, min: 0, max: 1 },
    llm_provider: { type: String },
    tool_calls: [
      {
        tool: String,
        input: mongoose.Schema.Types.Mixed,
        output: mongoose.Schema.Types.Mixed,
        success: Boolean,
        duration_ms: Number,
        timestamp: String,
      },
    ],
    reasoning_steps: [
      {
        step: Number,
        thought: String,
        timestamp: String,
      },
    ],
    final_reply: { type: String },
    escalation_summary: { type: String },
    flags: {
      is_fraud_flagged: Boolean,
      is_social_engineering: Boolean,
      has_threatening_language: Boolean,
    },
    started_at: { type: String },
    completed_at: { type: String },
    processing_time_ms: { type: Number },
    error: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
