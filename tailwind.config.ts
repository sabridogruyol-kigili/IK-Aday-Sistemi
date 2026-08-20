import type { Config } from "tailwindcss";

// Marka kimliği: mevcut İşe Alım modülü mockup'ıyla aynı token seti.
// Yeni bir tema icat etmiyoruz — Norm Kadro modülü bu paleti genişletiyor.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#00365a",
          2: "#00294a",
          3: "#001d36",
        },
        accent: "#e8a020",
        success: { DEFAULT: "#2d7a3a", bg: "#eaf4ec" },
        danger: { DEFAULT: "#b03030", bg: "#faeaea" },
        info: { DEFAULT: "#1a5fa0", bg: "#e6f1fb" },
      },
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
export default config;
