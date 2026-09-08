import type { Config } from "tailwindcss";

// Kiğılı marka kimliği: koyu lacivert + kağıt beyazı + terzi işi hassasiyet.
// "SaaS kart kiti" (her yerde aynı yuvarlak köşe + soft gölge) yerine ince
// çerçeveler ve keskin köşelerle disiplinli bir hiyerarşi kuruluyor.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0F1B4D",
          2: "#1B2E6B",
          3: "#0A122E",
        },
        accent: "#C08A2E",
        success: { DEFAULT: "#2F6F4E", bg: "#EAF3DE" },
        danger: { DEFAULT: "#B0402E", bg: "#FCEBEB" },
        info: { DEFAULT: "#3E7CB1", bg: "#E9F1F7" },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        card: "6px",
      },
    },
  },
  plugins: [],
};
export default config;
