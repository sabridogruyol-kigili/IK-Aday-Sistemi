"use client";

import { useEffect, useState } from "react";

// Recharts (ve benzeri SVG tabanlı grafik kütüphaneleri), rengi CSS
// sınıfıyla değil doğrudan "stroke"/"fill" prop'uyla aldığı için,
// globals.css'teki CSS değişken sistemi onlara hiç ulaşmıyor. Bu hook,
// koyu mod açık/kapalı durumunu React state olarak verir — grafik
// bileşenleri buna göre kendi renk setini seçer.
export function useTemaKoyuMu(): boolean {
  const [koyu, setKoyu] = useState(false);

  useEffect(() => {
    const kontrolEt = () => setKoyu(document.documentElement.classList.contains("dark"));
    kontrolEt();
    window.addEventListener("temadegisti", kontrolEt);
    return () => window.removeEventListener("temadegisti", kontrolEt);
  }, []);

  return koyu;
}

// Grafiklerde tekrar tekrar kullanılan ortak renk seti — açık/koyu moda
// göre tek yerden yönetiliyor. Yeni bir grafik eklerken bunu kullanın.
export function grafikRenkleri(koyu: boolean) {
  return {
    izgara: koyu ? "#2C3554" : "#eee",
    eksenMetni: koyu ? "#8F97AB" : "#6b7280",
    ortalamaCizgi: koyu ? "#7A8296" : "#9ca3af",
    navy: koyu ? "#6E8BDB" : "#0F1B4D",
    success: koyu ? "#5CC78A" : "#2F6F4E",
    danger: koyu ? "#E06F5A" : "#B0402E",
    info: koyu ? "#6EAAD9" : "#3E7CB1",
    accent: koyu ? "#D4A65A" : "#C08A2E",
    tooltipBg: koyu ? "#141A2E" : "#ffffff",
    tooltipBorder: koyu ? "#3A4468" : "#e5e7eb",
    tooltipMetin: koyu ? "#E8EAF2" : "#0A122E",
  };
}
