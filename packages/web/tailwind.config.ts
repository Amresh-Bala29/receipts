import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        refined: {
          50: "#F7F7F7",
          100: "#ECECEC",
          200: "#DDDDDD",
          400: "#A0A0A0",
          500: "#6B6B6B",
          600: "#4B4B4B",
          700: "#2A2A2A",
          950: "#0A0A0A",
        },
        accent: {
          50: "#ecfdf9",
          100: "#d1faf0",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
        serif: ["var(--font-serif)", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        soft: "0 18px 50px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
