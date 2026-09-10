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
      boxShadow: {
        card: "0 1px 2px rgba(15, 27, 77, 0.04)",
        "card-hover": "0 4px 12px -4px rgba(15, 27, 77, 0.18)",
        button: "0 4px 10px -4px rgba(15, 27, 77, 0.35)",
      },
      backgroundImage: {
        // Düz laciverdin yerine, sadece belirgin vurgu alanlarında (örn.
        // panel başlıkları, evrak portalı üst şeridi) kullanılacak ince bir
        // gradyan — her yere sürülmüyor, sadece bir "kahraman" alanda.
        "navy-gradient": "linear-gradient(135deg, #0F1B4D 0%, #1B2E6B 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
