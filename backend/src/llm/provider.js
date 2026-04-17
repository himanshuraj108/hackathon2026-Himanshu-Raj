require("dotenv").config();
const { createGroqProvider } = require("./groq");
const { createGeminiProvider } = require("./gemini");
const logger = require("../utils/logger");

/**
 * LLM Provider with automatic fallback chain.
 * Priority: Groq (primary) -> Gemini (backup)
 * If a provider fails, the next one is tried transparently.
 */

const providers = [];

// Register Groq if key is present
if (process.env.GROQ_API_KEY) {
  providers.push({ name: "groq", instance: createGroqProvider() });
}

// Register Gemini if key is present
if (process.env.GEMINI_API_KEY) {
  providers.push({ name: "gemini", instance: createGeminiProvider() });
}

if (providers.length === 0) {
  throw new Error(
    "No LLM provider configured. Set at least one of: GROQ_API_KEY, GEMINI_API_KEY in your .env file."
  );
}

/**
 * Call the LLM with automatic fallback.
 * @param {string} prompt - The full prompt to send
 * @param {object} options - Optional parameters (temperature, max_tokens)
 * @returns {Promise<{text: string, provider: string, model: string}>}
 */
async function callLLM(prompt, options = {}) {
  const errors = [];

  for (const provider of providers) {
    try {
      logger.info(`[LLM] Attempting call via provider: ${provider.name}`);
      const result = await provider.instance.complete(prompt, options);
      logger.info(`[LLM] Success via provider: ${provider.name}`, { model: result.model });
      return { ...result, provider: provider.name };
    } catch (err) {
      logger.warn(`[LLM] Provider ${provider.name} failed: ${err.message}`);
      errors.push({ provider: provider.name, error: err.message });
    }
  }

  // All providers failed
  const errorSummary = errors.map((e) => `${e.provider}: ${e.error}`).join(" | ");
  throw new Error(`All LLM providers failed. Errors: ${errorSummary}`);
}

module.exports = { callLLM };
