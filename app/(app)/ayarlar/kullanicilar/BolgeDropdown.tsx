"use client";

import { useEffect, useRef, useState } from "react";

type Bolge = { id: string; ad: string };

export default function BolgeDropdown({ bolgeler }: { bolgeler: Bolge[] }) {
  const [acik, setAcik] = useState(false);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const kutuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function disaTikla(e: MouseEvent) {
      if (kutuRef.current && !kutuRef.current.contains(e.target as Node)) setAcik(false);
    }
    document.addEventListener("mousedown", disaTikla);
    return () => document.removeEventListener("mousedown", disaTikla);
  }, []);

  function toggle(id: string) {
    setSecili((prev) => {
      const yeni = new Set(prev);
      if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
      return yeni;
    });
  }

  const etiket =
    secili.size === 0 ? "Bölge seçin"
      : secili.size === 1 ? bolgeler.find((b) => secili.has(b.id))?.ad ?? "1 bölge"
      : `${secili.size} bölge seçili`;

  return (
    <div className="relative" ref={kutuRef}>
      <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Sorumlu Bölge(ler)</label>
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm text-left bg-white flex items-center justify-between"
      >
        <span className={secili.size === 0 ? "text-gray-400" : "text-navy-3"}>{etiket}</span>
        <span className={`text-[9px] text-gray-400 transition-transform ${acik ? "rotate-180" : ""}`}>▼</span>
      </button>

      {/* Checkbox'lar kapalıyken de DOM'da kalır (sadece görsel olarak gizlenir) ki form gönderiminde seçimler kaybolmasın. */}
      <div className={`absolute z-20 mt-1 w-56 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100 ${acik ? "block" : "hidden"}`}>
        {bolgeler.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-xs text-gray-600 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              name="bolge_ids"
              value={b.id}
              checked={secili.has(b.id)}
              onChange={() => toggle(b.id)}
            />
            {b.ad}
          </label>
        ))}
        {bolgeler.length === 0 && (
          <div className="text-xs text-gray-400 px-2.5 py-2">Henüz bölge tanımlı değil.</div>
        )}
      </div>
    </div>
  );
}
