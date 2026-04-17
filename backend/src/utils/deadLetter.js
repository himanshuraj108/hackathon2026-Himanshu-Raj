const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const DLQ_PATH = path.join(__dirname, "../../dead_letter_queue.json");

/**
 * Dead-Letter Queue (DLQ)
 *
 * Failed tickets that exhaust all retries are persisted here.
 * They are never silently dropped. The dashboard surfaces them for manual review.
 *
 * Guarantees:
 *   - Each ticket_id appears at most once (deduplication via upsert)
 *   - File is reset at process start via clearDLQ() called from main.js
 */

let _cache = null;

function loadDLQ() {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(DLQ_PATH)) {
      _cache = JSON.parse(fs.readFileSync(DLQ_PATH, "utf-8"));
      return _cache;
    }
  } catch {
    // Corrupt file — start fresh
  }
  _cache = [];
  return _cache;
}

function saveDLQ(entries) {
  _cache = entries;
  fs.writeFileSync(DLQ_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

/**
 * Clear the DLQ at the start of each run so nodemon restarts don't accumulate stale entries.
 */
function clearDLQ() {
  _cache = [];
  saveDLQ([]);
  logger.info("[DLQ] Dead-letter queue cleared for fresh run.");
}

/**
 * Add a failed ticket to the DLQ (upsert — no duplicates).
 * @param {object} ticket - The original ticket object
 * @param {Error}  error  - The error that caused the failure
 * @param {object} meta   - Additional context (retry_count, last_tool, etc.)
 */
function pushToDLQ(ticket, error, meta = {}) {
  const entries = loadDLQ();

  const entry = {
    ticket_id: ticket.ticket_id,
    customer_email: ticket.customer_email,
    subject: ticket.subject,
    error: error.message,
    error_type: error.name || "UnknownError",
    timestamp: new Date().toISOString(),
    retry_count: meta.retry_count || 0,
    last_tool: meta.last_tool || null,
    reasoning_so_far: meta.reasoning_so_far || [],
  };

  // UPSERT — replace existing entry for same ticket_id rather than duplicating
  const existingIndex = entries.findIndex((e) => e.ticket_id === ticket.ticket_id);
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  saveDLQ(entries);

  logger.error(`[DLQ] Ticket ${ticket.ticket_id} moved to dead-letter queue`, {
    ticket_id: ticket.ticket_id,
    error: error.message,
  });

  return entry;
}

/**
 * Get all DLQ entries (for dashboard API).
 */
function getDLQ() {
  return loadDLQ();
}

/**
 * Remove a specific ticket from DLQ after manual resolution.
 */
function removeFromDLQ(ticketId) {
  const entries = loadDLQ().filter((e) => e.ticket_id !== ticketId);
  saveDLQ(entries);
}

module.exports = { pushToDLQ, getDLQ, clearDLQ, removeFromDLQ };
