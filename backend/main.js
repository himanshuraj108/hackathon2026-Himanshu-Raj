/**
 * main.js — Entry Point for the ShopWave Autonomous Support Agent
 *
 * Usage:
 *   node main.js                   # Process all 20 tickets concurrently
 *   node main.js --ticket TKT-001  # Process a single ticket
 *   node main.js --server          # Start only the API server
 *
 * Concurrency model:
 *   - Uses p-limit to cap concurrent ticket processing at MAX_CONCURRENCY
 *   - All tickets within the cap are processed in true parallel (Promise.all)
 *   - Failed tickets are routed to the dead-letter queue, never dropped
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs");

/**
 * Simple concurrency limiter — replaces p-limit (which is ESM-only in v6+).
 * Returns a wrapper function that queues tasks and runs at most `concurrency` at once.
 */
function createLimiter(concurrency) {
  let active = 0;
  const queue = [];

  function run() {
    while (active < concurrency && queue.length > 0) {
      const { fn, resolve, reject } = queue.shift();
      active++;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active--;
          run();
        });
    }
  }

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      run();
    });
  };
}

const { processTicket } = require("./src/agent/orchestrator");
const { pushToDLQ, clearDLQ } = require("./src/utils/deadLetter");
const { app, connectDB } = require("./src/app");
const logger = require("./src/utils/logger");
const AuditLog = require("./src/models/AuditLog");

const tickets = require("./src/data/tickets.json");

const PORT = process.env.PORT || 4000;
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY) || 5;
const AUDIT_LOG_PATH = path.join(__dirname, "audit_log.json");

// ──────────────────────────────────────────────────────────────────
// Parse CLI arguments
// ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const singleTicketFlag = args.indexOf("--ticket");
const serverOnly = args.includes("--server");

// ──────────────────────────────────────────────────────────────────
// Main execution
// ──────────────────────────────────────────────────────────────────
async function main() {
  logger.info("=".repeat(60));
  logger.info("  ShopWave Autonomous Support Resolution Agent");
  logger.info("  Hackathon 2026 — MERN Stack | Groq + Gemini LLMs");
  logger.info("=".repeat(60));

  // Start API server (always)
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`[Server] API running at http://localhost:${PORT}`);
    logger.info(`[Server] Dashboard API: http://localhost:${PORT}/api/audit`);
    logger.info(`[Server] Health check:  http://localhost:${PORT}/api/health`);
  });

  if (serverOnly) {
    logger.info("[Server] Running in server-only mode. No tickets will be processed.");
    return;
  }

  // Determine which tickets to process
  let ticketsToProcess;

  if (singleTicketFlag !== -1 && args[singleTicketFlag + 1]) {
    const targetId = args[singleTicketFlag + 1].toUpperCase();
    ticketsToProcess = tickets.filter((t) => t.ticket_id === targetId);
    if (ticketsToProcess.length === 0) {
      logger.error(`[Main] Ticket ${targetId} not found in tickets.json`);
      process.exit(1);
    }
    logger.info(`[Main] Processing single ticket: ${targetId}`);
  } else {
    ticketsToProcess = tickets;
    logger.info(`[Main] Processing all ${ticketsToProcess.length} tickets with concurrency limit: ${MAX_CONCURRENCY}`);
  }

  // ── Fresh-run cleanup ────────────────────────────────────────
  // Clear DLQ and audit log so each run starts with a clean slate.
  // Prevents nodemon restarts from accumulating duplicate entries.
  clearDLQ();

  // ── Concurrent Processing ─────────────────────────────────────
  const limit = createLimiter(MAX_CONCURRENCY);
  const auditEntries = [];
  const failed = [];

  const tasks = ticketsToProcess.map((ticket) =>
    limit(async () => {
      try {
        logger.info(`[Main] Dispatching ticket ${ticket.ticket_id}`);
        const auditEntry = await processTicket(ticket);
        auditEntries.push(auditEntry);

        // Persist to MongoDB (if connected)
        try {
          await AuditLog.findOneAndUpdate(
            { ticket_id: auditEntry.ticket_id },
            auditEntry,
            { upsert: true, new: true }
          );
        } catch (dbErr) {
          logger.warn(`[Main] Could not persist audit to DB for ${ticket.ticket_id}: ${dbErr.message}`);
        }

        logger.info(`[Main] Completed ticket ${ticket.ticket_id} [${auditEntry.status}] confidence=${auditEntry.confidence_score}`);
      } catch (err) {
        failed.push({ ticket, error: err });
        pushToDLQ(ticket, err, { retry_count: 3 });
        logger.error(`[Main] Ticket ${ticket.ticket_id} sent to DLQ: ${err.message}`);
      }
    })
  );

  await Promise.all(tasks);

  // ── Write audit_log.json ──────────────────────────────────────
  auditEntries.sort((a, b) => a.ticket_id.localeCompare(b.ticket_id));
  fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(auditEntries, null, 2), "utf-8");
  logger.info(`[Main] Audit log written to: ${AUDIT_LOG_PATH}`);

  // ── Final Summary ─────────────────────────────────────────────
  const resolved = auditEntries.filter((e) => e.status === "resolved").length;
  const escalated = auditEntries.filter((e) => e.status === "escalated").length;
  const avgConfidence = auditEntries.reduce((s, e) => s + e.confidence_score, 0) / auditEntries.length;

  logger.info("=".repeat(60));
  logger.info(`  PROCESSING COMPLETE`);
  logger.info(`  Total tickets:    ${ticketsToProcess.length}`);
  logger.info(`  Resolved:         ${resolved}`);
  logger.info(`  Escalated:        ${escalated}`);
  logger.info(`  Failed (DLQ):     ${failed.length}`);
  logger.info(`  Avg confidence:   ${avgConfidence.toFixed(2)}`);
  logger.info(`  Audit log:        audit_log.json`);
  logger.info("=".repeat(60));
}

main().catch((err) => {
  logger.error(`[Main] Fatal error: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
