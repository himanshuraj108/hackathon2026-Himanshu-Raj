const { GoogleGenerativeAI } = require("@google/generative-ai");

function createGeminiProvider() {
  return {
    name: "gemini",

    async complete(prompt, options = {}) {
      // Support comma-separated keys and models for load balancing
      const keys = (process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim());
      const models = (process.env.GEMINI_MODEL || "gemini-1.5-flash").split(",").map((m) => m.trim());

      const apiKey = keys[Math.floor(Math.random() * keys.length)];
      const MODEL = models[Math.floor(Math.random() * models.length)];

      if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

      const client = new GoogleGenerativeAI(apiKey);
      const model = client.getGenerativeModel({
        model: MODEL,
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
      return { text, model: MODEL };
    },
  };
}

module.exports = { createGeminiProvider };
