const winston = require("winston");
const path = require("path");

const LOG_DIR = path.join(__dirname, "../../logs");

/**
 * Structured JSON logger using Winston.
 * All log entries include: timestamp, level, message, and any metadata.
 * This powers the audit trail visible in the dashboard.
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "shopwave-agent" },
  transports: [
    // Console output (human-readable in dev)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length && meta.service === undefined
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `${timestamp} [${level}] ${message}${metaStr}`;
        })
      ),
    }),
    // File output — machine-readable JSON for audit log generation
    new winston.transports.File({
      filename: path.join(LOG_DIR, "agent.log"),
      maxsize: 10 * 1024 * 1024, // 10MB rotation
      maxFiles: 5,
    }),
    // Separate error log
    new winston.transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      level: "error",
    }),
  ],
});

// Ensure log dir exists
const fs = require("fs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

module.exports = logger;
