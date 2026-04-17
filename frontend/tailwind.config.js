/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        bg: {
          primary: "#0a0c10",
          secondary: "#0f1117",
          card: "#13161e",
          elevated: "#1e2230",
        },
        brand: {
          indigo: "#6366f1",
          cyan: "#22d3ee",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
          violet: "#8b5cf6",
        },
      },
      animation: {
        "pulse-dot": "pulseDot 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in": "fadeIn 0.15s ease",
        "slide-up": "slideUp 0.2s cubic-bezier(0.4,0,0.2,1)",
        spin: "spin 0.8s linear infinite",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
