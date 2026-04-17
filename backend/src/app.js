require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const logger = require("./utils/logger");

const auditRoutes = require("./routes/audit");

const app = express();

// ── Security & Middleware ──────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined", { stream: { write: (msg) => logger.http(msg.trim()) } }));

// ── Routes ────────────────────────────────────────────────
app.use("/api/audit", auditRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "shopwave-agent-api",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ── 404 handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found." });
});

// ── Global Error Handler ──────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`[API Error] ${err.message}`, { stack: err.stack });
  res.status(500).json({ success: false, error: "Internal server error." });
});

// ── Database Connection ───────────────────────────────────
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn("[DB] MONGODB_URI not set. Running without persistent storage — audit log will use JSON file only.");
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info("[DB] MongoDB connected successfully.");
  } catch (err) {
    logger.warn(`[DB] MongoDB connection failed: ${err.message}. Continuing without DB.`);
  }
}

module.exports = { app, connectDB };
