"use client";

import { useEffect, useRef, useState } from "react";

type Magaza = {
  id: string; magaza_kodu: string; magaza_adi: string; bolge_id: string | null; bolge_adi: string;
  ana_norm: number; ana_dolu: number; donemsel_norm: number; donemsel_dolu: number;
  part_norm: number; part_dolu: number; toplamNorm: number; toplamDolu: number; oran: number;
};
type Bolge = { id: string; ad: string };

function oranHesap(dolu: number, norm: number) {
  return norm > 0 ? Math.min(Math.round((dolu / norm) * 100), 100) : 0;
}

export default function DashboardMagazaPaneli({ magazalar, bolgeler }: { magazalar: Magaza[]; bolgeler: Bolge[] }) {
  const [secilenBolgeler, setSecilenBolgeler] = useState<Set<string>>(new Set());
  const [bolgeFiltreAcik, setBolgeFiltreAcik] = useState(false);
  const [normMin, setNormMin] = useState("");
  const [normMax, setNormMax] = useState("");
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

  const filtrelenmis = magazalar.filter((m) => {
    if (secilenBolgeler.size > 0 && (!m.bolge_id || !secilenBolgeler.has(m.bolge_id))) return false;
    if (normMin !== "" && m.toplamNorm < Number(normMin)) return false;
    if (normMax !== "" && m.toplamNorm > Number(normMax)) return false;
    return true;
  });

  const bolgeEtiket =
    secilenBolgeler.size === 0 ? "Tüm Bölgeler"
      : secilenBolgeler.size === 1 ? bolgeler.find((b) => secilenBolgeler.has(b.id))?.ad ?? "1 bölge"
      : `${secilenBolgeler.size} bölge seçili`;

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4">
      <div className="text-sm font-semibold text-navy-3 mb-2">Mağazalar — Norm Doluluk</div>

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
          <span className="text-[10px] text-gray-400">Norm</span>
          <input type="number" value={normMin} onChange={(e) => setNormMin(e.target.value)} placeholder="min"
            className="w-12 border border-gray-300 rounded-md px-1 py-1 text-[11px]" />
          <span className="text-gray-300 text-[10px]">–</span>
          <input type="number" value={normMax} onChange={(e) => setNormMax(e.target.value)} placeholder="max"
            className="w-12 border border-gray-300 rounded-md px-1 py-1 text-[11px]" />
        </div>

        <div className="flex items-center gap-3 ml-auto text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-navy inline-block" /> Ana Kadro</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Dönemsel</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-info inline-block" /> Part Time</span>
        </div>
      </div>

      {filtrelenmis.length === 0 ? (
        <div className="text-xs text-gray-400">Bu filtreye uyan mağaza yok.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
          {filtrelenmis.map((m) => (
            <div key={m.id} className="border border-gray-100 rounded-md p-2" title={`${m.magaza_adi} — ${m.bolge_adi}`}>
              <div className="text-[11px] text-gray-700 truncate mb-0.5 font-medium">{m.magaza_adi}</div>
              <div className="text-[9px] text-gray-400 truncate mb-1.5">{m.bolge_adi || "—"}</div>

              <div className="space-y-1">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-navy rounded-full" style={{ width: `${oranHesap(m.ana_dolu, m.ana_norm)}%` }} />
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${oranHesap(m.donemsel_dolu, m.donemsel_norm)}%` }} />
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-info rounded-full" style={{ width: `${oranHesap(m.part_dolu, m.part_norm)}%` }} />
                </div>
              </div>

              <div className="text-[9px] text-gray-400 font-mono mt-1.5">
                {m.toplamDolu}/{m.toplamNorm} (%{m.oran})
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
