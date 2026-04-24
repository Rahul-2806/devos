/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        devos: {
          black: "#0a0a0f",
          dark: "#0f0f1a",
          card: "#13131f",
          border: "#1e1e2e",
          muted: "#2a2a3e",
          text: "#e2e8f0",
          muted_text: "#64748b",
          accent: "#6366f1",
          accent2: "#8b5cf6",
          blue: "#3b82f6",
          teal: "#14b8a6",
          amber: "#f59e0b",
          coral: "#f97316",
          green: "#22c55e",
          red: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: ["var(--font-cal)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grid-pattern": "linear-gradient(to right, #1e1e2e 1px, transparent 1px), linear-gradient(to bottom, #1e1e2e 1px, transparent 1px)",
        "glow-conic": "conic-gradient(from 180deg at 50% 50%, #6366f1, #8b5cf6, #6366f1)",
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease forwards",
        "fade-in": "fadeIn 0.4s ease forwards",
        "slide-in": "slideIn 0.5s ease forwards",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      boxShadow: {
        "glow-sm": "0 0 15px rgba(99, 102, 241, 0.15)",
        "glow-md": "0 0 30px rgba(99, 102, 241, 0.2)",
        "glow-lg": "0 0 60px rgba(99, 102, 241, 0.25)",
        "card": "0 0 0 1px rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};
