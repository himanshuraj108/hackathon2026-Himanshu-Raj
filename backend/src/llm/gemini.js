const { GoogleGenerativeAI } = require("@google/generative-ai");

function createGeminiProvider() {
  return {
    name: "gemini",

    async complete(prompt, options = {}) {
      // Gather all available keys from env
      const keys = [];
      if (process.env.GEMINI_API_KEY) keys.push(...process.env.GEMINI_API_KEY.split(","));
      if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2);
      
      const cleanKeys = keys.map(k => k.trim()).filter(Boolean);
      if (cleanKeys.length === 0) throw new Error("No GEMINI_API_KEY found");

      // Gather available models
      const models = [];
      if (process.env.GEMINI_MODEL) models.push(...process.env.GEMINI_MODEL.split(","));
      if (process.env.GEMINI_MODEL_2) models.push(process.env.GEMINI_MODEL_2);
      const cleanModels = models.map(m => m.trim()).filter(Boolean);
      const modelToUse = cleanModels.length > 0 ? cleanModels[0] : "gemini-1.5-flash";

      let lastError;

      // Real Fallback Sequence: Try each key, if rate limited, move to the next key
      for (let i = 0; i < cleanKeys.length; i++) {
        const apiKey = cleanKeys[i];
        
        try {
          const client = new GoogleGenerativeAI(apiKey);
          const model = client.getGenerativeModel({
            model: modelToUse,
            systemInstruction:
              "You are an autonomous support resolution agent for ShopWave e-commerce. You reason step-by-step, make tool calls to gather data, and produce structured JSON decisions. Always be professional, empathetic, and precise.",
            generationConfig: {
              temperature: options.temperature ?? 0.2,
              maxOutputTokens: options.max_tokens ?? 2048,
              responseMimeType: options.json_mode ? "application/json" : "text/plain",
            },
          });

          const result = await model.generateContent(prompt);
          const text = result.response.text();
          return { text, model: modelToUse };
        } catch (error) {
          lastError = error;
          
          // Check for common Gemini rate limit / auth errors
          const isRateLimit = error.status === 429 || error.message.includes("429") || error.message.includes("quota");
          const isAuth = error.status === 401 || error.status === 403 || error.message.includes("API_KEY_INVALID");
          
          if (isRateLimit || isAuth) {
            console.warn(`[LLM Fallback] Gemini key ${i + 1} failed. Trying next key...`);
            continue;
          }
          
          throw error;
        }
      }

      // If all keys failed
      throw lastError;
    },
  };
}

module.exports = { createGeminiProvider };
