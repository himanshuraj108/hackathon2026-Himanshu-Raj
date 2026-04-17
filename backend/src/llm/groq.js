const Groq = require("groq-sdk");

function createGroqProvider() {
  return {
    name: "groq",

    async complete(prompt, options = {}) {
      // Support comma-separated API keys for rotation/load balancing
      const keys = (process.env.GROQ_API_KEY || "").split(",").map((k) => k.trim());
      const apiKey = keys[Math.floor(Math.random() * keys.length)];
      
      if (!apiKey) throw new Error("GROQ_API_KEY is missing");

      const client = new Groq({ apiKey });
      const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an autonomous support resolution agent for ShopWave e-commerce. You reason step-by-step, make tool calls to gather data, and produce structured JSON decisions. Always be professional, empathetic, and precise.",
          },
          { role: "user", content: prompt },
        ],
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens ?? 2048,
        response_format: options.json_mode ? { type: "json_object" } : undefined,
      });

      const text = response.choices[0]?.message?.content || "";
      return { text, model: MODEL };
    },
  };
}

module.exports = { createGroqProvider };
