const Groq = require("groq-sdk");

function createGroqProvider() {
  return {
    name: "groq",

    async complete(prompt, options = {}) {
      // Gather all available keys from env
      const keys = [];
      if (process.env.GROQ_API_KEY) keys.push(...process.env.GROQ_API_KEY.split(","));
      if (process.env.GROQ_API_KEY_2) keys.push(process.env.GROQ_API_KEY_2);
      
      const cleanKeys = keys.map(k => k.trim()).filter(Boolean);
      if (cleanKeys.length === 0) throw new Error("No GROQ_API_KEY found");

      const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      
      let lastError;

      // Real Fallback Sequence: Try each key, if rate limited (429), move to the next key
      for (let i = 0; i < cleanKeys.length; i++) {
        const apiKey = cleanKeys[i];
        
        try {
          const client = new Groq({ apiKey });
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
        } catch (error) {
          lastError = error;
          
          // If rate limited or unauthenticated, log and try the next key
          if (error.status === 429 || error.status === 401 || error.status === 403) {
            console.warn(`[LLM Fallback] Groq key ${i + 1} failed (${error.status}). Trying next key...`);
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

module.exports = { createGroqProvider };
