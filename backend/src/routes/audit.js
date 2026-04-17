const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");
const { getDLQ } = require("../utils/deadLetter");

/**
 * GET /api/audit/stats/summary
 * Dashboard statistics: counts by status, decision, confidence distribution.
 * MUST be defined before /:ticket_id to avoid Express matching "stats" as a ticket_id.
 */
router.get("/stats/summary", async (req, res) => {
  try {
    const [statusCounts, decisionCounts, avgConfidence, flagCounts] = await Promise.all([
      AuditLog.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      AuditLog.aggregate([{ $group: { _id: "$decision", count: { $sum: 1 } } }]),
      AuditLog.aggregate([{ $group: { _id: null, avg: { $avg: "$confidence_score" } } }]),
      AuditLog.aggregate([
        {
          $group: {
            _id: null,
            fraud_flagged: { $sum: { $cond: ["$flags.is_fraud_flagged", 1, 0] } },
            social_engineering: { $sum: { $cond: ["$flags.is_social_engineering", 1, 0] } },
            threatening: { $sum: { $cond: ["$flags.has_threatening_language", 1, 0] } },
          },
        },
      ]),
    ]);

    const dlq = getDLQ();

    res.json({
      success: true,
      data: {
        total_processed: await AuditLog.countDocuments(),
        by_status: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
        by_decision: Object.fromEntries(decisionCounts.map((d) => [d._id, d.count])),
        avg_confidence: parseFloat((avgConfidence[0]?.avg || 0).toFixed(2)),
        flags: flagCounts[0] || { fraud_flagged: 0, social_engineering: 0, threatening: 0 },
        dead_letter_queue_count: dlq.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/audit/dlq/list
 * Returns all dead-letter queue entries.
 * MUST be defined before /:ticket_id.
 */
router.get("/dlq/list", (req, res) => {
  try {
    const dlq = getDLQ();
    res.json({ success: true, count: dlq.length, data: dlq });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/audit
 * Returns all audit log entries, sorted by creation time (newest first).
 * Supports query: ?ticket_id=TKT-001&status=escalated&limit=20
 */
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.ticket_id) filter.ticket_id = req.query.ticket_id;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.decision) filter.decision = req.query.decision;

    const limit = parseInt(req.query.limit) || 50;

    const entries = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, count: entries.length, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/audit/:ticket_id
 * Returns the full audit entry for a specific ticket.
 * MUST be defined LAST — it is a catch-all for any unmatched segment.
 */
router.get("/:ticket_id", async (req, res) => {
  try {
    const entry = await AuditLog.findOne({ ticket_id: req.params.ticket_id }).lean();
    if (!entry) {
      return res.status(404).json({ success: false, error: "Ticket not found in audit log." });
    }
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
