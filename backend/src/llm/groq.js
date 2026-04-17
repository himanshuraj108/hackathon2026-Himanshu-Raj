const Groq = require("groq-sdk");

function createGroqProvider() {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  return {
    name: "groq",
    model: MODEL,

    async complete(prompt, options = {}) {
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
