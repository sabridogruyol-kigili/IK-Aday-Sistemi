"use client";

import { useEffect, useState } from "react";

export default function TemaDegistirici() {
  const [koyu, setKoyu] = useState(false);

  useEffect(() => {
    setKoyu(document.documentElement.classList.contains("dark"));
  }, []);

  function degistir() {
    const yeniKoyu = !koyu;
    setKoyu(yeniKoyu);
    document.documentElement.classList.toggle("dark", yeniKoyu);
    try {
      localStorage.setItem("tema", yeniKoyu ? "koyu" : "acik");
    } catch {}
  }

  return (
    <button
      onClick={degistir}
      title={koyu ? "Açık moda geç" : "Koyu moda geç"}
      className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors text-[11px]"
    >
      <span className="text-sm">{koyu ? "☀️" : "🌙"}</span>
      <span>{koyu ? "Açık Mod" : "Koyu Mod"}</span>
    </button>
  );
}
