import type { Config } from "tailwindcss";

// Kiğılı marka kimliği: koyu lacivert + kağıt beyazı + terzi işi hassasiyet.
// "SaaS kart kiti" (her yerde aynı yuvarlak köşe + soft gölge) yerine ince
// çerçeveler ve keskin köşelerle disiplinli bir hiyerarşi kuruluyor.
const config: Config = {
  darkMode: "class",
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
          // navy-3 hem METİN (çok kullanılıyor) hem ARKA PLAN (daha az ama
          // var) olarak kullanıldığı için token yapılamadı — ikisi zıt
          // yönde davranması gerekirdi (metin açılmalı, arka plan koyu
          // kalmalı). Statik bırakıldı, metin kullanımı globals.css'te
          // ayrıca ele alınıyor.
          3: "#0A122E",
        },
        accent: "#C08A2E",
        success: { DEFAULT: "#2F6F4E", bg: "rgb(var(--c-success-bg) / <alpha-value>)" },
        danger: { DEFAULT: "#B0402E", bg: "rgb(var(--c-danger-bg) / <alpha-value>)" },
        info: { DEFAULT: "#3E7CB1", bg: "rgb(var(--c-info-bg) / <alpha-value>)" },
        // Standart Tailwind gri paleti, CSS değişkenlerine bağlandı — bu
        // sayede "text-gray-400", "border-gray-200", hatta "bg-gray-50/60"
        // gibi opaklık varyantlarının TAMAMI, tek bir yerden (globals.css'teki
        // :root / .dark blokları) otomatik olarak açık/koyu moda göre doğru
        // değeri alır. Yeni bir sayfa eklerken bu sınıfları normal şekilde
        // kullanmaya devam edin — karanlık mod için ekstra hiçbir şey
        // yazmanıza gerek yok.
        gray: {
          50: "rgb(var(--c-gray-50) / <alpha-value>)",
          100: "rgb(var(--c-gray-100) / <alpha-value>)",
          200: "rgb(var(--c-gray-200) / <alpha-value>)",
          300: "rgb(var(--c-gray-300) / <alpha-value>)",
          400: "rgb(var(--c-gray-400) / <alpha-value>)",
          500: "rgb(var(--c-gray-500) / <alpha-value>)",
          600: "rgb(var(--c-gray-600) / <alpha-value>)",
          700: "rgb(var(--c-gray-700) / <alpha-value>)",
          800: "rgb(var(--c-gray-800) / <alpha-value>)",
          900: "rgb(var(--c-gray-900) / <alpha-value>)",
        },
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
