"use client";

import { useEffect, useRef, useState } from "react";

type Performans = { id: string; magaza_adi: string; bolge_id: string | null; bolge_adi: string; yil: number; ay: number; hgo: number };
type Bolge = { id: string; ad: string };

const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function hgoRenk(hgo: number) {
  if (hgo < 80) return { bar: "bg-danger", metin: "text-danger" };
  if (hgo <= 100) return { bar: "bg-accent", metin: "text-accent" };
  return { bar: "bg-success", metin: "text-success" };
}

export default function DashboardPerformansPaneli({ performanslar, bolgeler }: { performanslar: Performans[]; bolgeler: Bolge[] }) {
  const [secilenBolgeler, setSecilenBolgeler] = useState<Set<string>>(new Set());
  const [bolgeFiltreAcik, setBolgeFiltreAcik] = useState(false);
  const [hgoMin, setHgoMin] = useState("");
  const [hgoMax, setHgoMax] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function disaTikla(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setBolgeFiltreAcik(false);
    }
    document.addEventListener("mousedown", disaTikla);
    return () => document.removeEventListener("mousedown", disaTikla);
  }, []);

  function bolgeToggle(id: string) {
    setSecilenBolgeler((prev) => {
      const yeni = new Set(prev);
      if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
      return yeni;
    });
  }

  const filtrelenmis = performanslar.filter((p) => {
    if (secilenBolgeler.size > 0 && (!p.bolge_id || !secilenBolgeler.has(p.bolge_id))) return false;
    if (hgoMin !== "" && p.hgo < Number(hgoMin)) return false;
    if (hgoMax !== "" && p.hgo > Number(hgoMax)) return false;
    return true;
  }).sort((a, b) => b.hgo - a.hgo);

  const bolgeEtiket =
    secilenBolgeler.size === 0 ? "Tüm Bölgeler"
      : secilenBolgeler.size === 1 ? bolgeler.find((b) => secilenBolgeler.has(b.id))?.ad ?? "1 bölge"
      : `${secilenBolgeler.size} bölge seçili`;

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4">
      <div className="text-sm font-semibold text-navy-3 mb-2">Mağazalar — Performans (HGO)</div>

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setBolgeFiltreAcik((v) => !v)}
            className="border border-gray-300 rounded-md px-2 py-1 text-[11px] bg-white flex items-center gap-1.5 min-w-[120px] justify-between"
          >
            <span className={secilenBolgeler.size === 0 ? "text-gray-500" : "text-navy-3"}>{bolgeEtiket}</span>
            <span className={`text-[8px] text-gray-400 transition-transform ${bolgeFiltreAcik ? "rotate-180" : ""}`}>▼</span>
          </button>
          <div className={`absolute z-20 mt-1 w-52 bg-white border border-gray-300 rounded-md shadow-lg max-h-52 overflow-y-auto divide-y divide-gray-100 ${bolgeFiltreAcik ? "block" : "hidden"}`}>
            {secilenBolgeler.size > 0 && (
              <button onClick={() => setSecilenBolgeler(new Set())} className="w-full text-left text-[11px] text-info px-2.5 py-1.5 hover:bg-gray-50">
                Seçimi temizle
              </button>
            )}
            {bolgeler.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-[11px] text-gray-600 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={secilenBolgeler.has(b.id)} onChange={() => bolgeToggle(b.id)} />
                {b.ad}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400">HGO %</span>
          <input type="number" value={hgoMin} onChange={(e) => setHgoMin(e.target.value)} placeholder="min"
            className="w-12 border border-gray-300 rounded-md px-1 py-1 text-[11px]" />
          <span className="text-gray-300 text-[10px]">–</span>
          <input type="number" value={hgoMax} onChange={(e) => setHgoMax(e.target.value)} placeholder="max"
            className="w-12 border border-gray-300 rounded-md px-1 py-1 text-[11px]" />
        </div>

        <div className="flex items-center gap-3 ml-auto text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger inline-block" /> &lt;80</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> 80–100</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> &gt;100</span>
        </div>
      </div>

      {filtrelenmis.length === 0 ? (
        <div className="text-xs text-gray-400">
          {performanslar.length === 0 ? "Henüz performans verisi içe aktarılmadı." : "Bu filtreye uyan mağaza yok."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
          {filtrelenmis.map((p) => {
            const renk = hgoRenk(p.hgo);
            return (
              <div key={p.id} className="border border-gray-100 rounded-md p-2" title={`${p.magaza_adi} — ${p.bolge_adi}`}>
                <div className="text-[11px] text-gray-700 truncate mb-0.5 font-medium">{p.magaza_adi}</div>
                <div className="text-[9px] text-gray-400 truncate mb-1.5">
                  {p.bolge_adi || "—"} · {AY_KISA[p.ay]} {p.yil}
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div className={`h-full rounded-full ${renk.bar}`} style={{ width: `${Math.min(p.hgo, 100)}%` }} />
                </div>
                <div className={`text-[10px] font-mono font-semibold ${renk.metin}`}>%{p.hgo.toFixed(1)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
