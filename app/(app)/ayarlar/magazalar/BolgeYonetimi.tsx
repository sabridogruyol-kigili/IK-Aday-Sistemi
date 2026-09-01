"use client";

import { useState, useTransition } from "react";
import { ekleBolge, silBolge, guncelleBolgeAdi } from "./actions";

type Bolge = { id: string; ad: string };

export default function BolgeYonetimi({ bolgeler }: { bolgeler: Bolge[] }) {
  const [pending, startTransition] = useTransition();
  const [yeniAd, setYeniAd] = useState("");
  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);
  const [duzenlenenAd, setDuzenlenenAd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [acik, setAcik] = useState(false);

  function ekle() {
    if (!yeniAd.trim()) return;
    setError(null);
    const fd = new FormData(); fd.set("ad", yeniAd.trim());
    startTransition(async () => {
      const res = await ekleBolge(fd);
      if (res?.error) { setError(res.error); return; }
      setYeniAd("");
    });
  }

  function sil(id: string, ad: string) {
    if (!confirm(`"${ad}" bölgesini silmek istediğinize emin misiniz?`)) return;
    setError(null);
    const fd = new FormData(); fd.set("id", id);
    startTransition(async () => {
      const res = await silBolge(fd);
      if (res?.error) setError(res.error);
    });
  }

  function kaydet(id: string) {
    if (!duzenlenenAd.trim()) return;
    setError(null);
    const fd = new FormData(); fd.set("id", id); fd.set("ad", duzenlenenAd.trim());
    startTransition(async () => {
      const res = await guncelleBolgeAdi(fd);
      if (res?.error) { setError(res.error); return; }
      setDuzenlenenId(null);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4">
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        className="flex items-center gap-2 text-xs font-medium text-navy-3 mb-1"
      >
        <span>{bolgeler.length} Bölge</span>
        <span className={`text-[9px] text-gray-400 transition-transform ${acik ? "rotate-180" : ""}`}>▼</span>
      </button>

      {acik && (
        <>
          <div className="flex flex-wrap gap-2 mb-3 mt-2">
            {bolgeler.map((b) => (
              <div key={b.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full pl-3 pr-1 py-1">
                {duzenlenenId === b.id ? (
                  <>
                    <input
                      value={duzenlenenAd}
                      onChange={(e) => setDuzenlenenAd(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && kaydet(b.id)}
                      autoFocus
                      className="text-xs border border-gray-300 rounded px-1.5 py-0.5 w-40"
                    />
                    <button onClick={() => kaydet(b.id)} disabled={pending} className="text-[10px] text-success px-1">✓</button>
                    <button onClick={() => setDuzenlenenId(null)} className="text-[10px] text-gray-400 px-1">✕</button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-navy-3">{b.ad}</span>
                    <button
                      onClick={() => { setDuzenlenenId(b.id); setDuzenlenenAd(b.ad); }}
                      className="text-[10px] text-info px-1.5 hover:underline"
                    >
                      düzenle
                    </button>
                    <button
                      onClick={() => sil(b.id, b.ad)}
                      disabled={pending}
                      className="text-[10px] text-danger px-1.5 rounded-full hover:bg-danger-bg"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <input
              value={yeniAd}
              onChange={(e) => setYeniAd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ekle()}
              placeholder="Yeni bölge adı"
              className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-56"
            />
            <button onClick={ekle} disabled={pending || !yeniAd.trim()} className="bg-navy text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
              + Bölge Ekle
            </button>
          </div>

          {error && <div className="text-[11px] text-danger mt-2">{error}</div>}
        </>
      )}
    </div>
  );
}
