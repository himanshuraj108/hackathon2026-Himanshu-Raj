const logger = require("./logger");

/**
 * Exponential backoff retry utility.
 *
 * Retries an async function with exponential delay and optional jitter.
 * Designed to handle transient tool failures gracefully.
 *
 * @param {Function} fn           - Async function to retry
 * @param {object}   options
 * @param {number}   options.maxRetries    - Max number of retry attempts (default: 3)
 * @param {number}   options.baseDelayMs  - Base delay in ms (default: 500)
 * @param {number}   options.maxDelayMs   - Maximum delay cap in ms (default: 8000)
 * @param {boolean}  options.jitter       - Add random jitter to delay (default: true)
 * @param {string}   options.toolName     - Tool name for logging context
 * @returns {Promise<any>}
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    jitter = true,
    toolName = "unknown_tool",
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        logger.info(`[Retry] ${toolName} succeeded on attempt ${attempt}/${maxRetries}`);
      }
      return result;
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        logger.error(`[Retry] ${toolName} exhausted all ${maxRetries} attempts. Last error: ${err.message}`);
        break;
      }

      // Exponential delay: 2^attempt * baseDelay, capped at maxDelay
      let delay = Math.min(Math.pow(2, attempt) * baseDelayMs, maxDelayMs);

      // Add ±20% jitter to avoid thundering herd
      if (jitter) {
        delay = delay * (0.8 + Math.random() * 0.4);
      }

      logger.warn(
        `[Retry] ${toolName} attempt ${attempt}/${maxRetries} failed: ${err.message}. Retrying in ${Math.round(delay)}ms`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { withRetry, sleep };
