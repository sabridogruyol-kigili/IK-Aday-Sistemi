"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { PersonelAylikHgo } from "./actions-cikarma";

const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// Grafiklerde seçilebilecek kişi bazlı satış değişkenleri.
const KISI_DEGISKENLERI: { key: keyof PersonelAylikHgo; label: string; format: (v: number) => string }[] = [
  { key: "hgo", label: "HGO (Ciro)", format: (v) => `%${v.toFixed(1)}` },
  { key: "adet_hgo", label: "HGO (Adet)", format: (v) => `%${v.toFixed(1)}` },
  { key: "gerceklesen_ciro_kdv_dahil", label: "Gerçekleşen Ciro", format: (v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) },
  { key: "gerceklesen_adet", label: "Gerçekleşen Adet", format: (v) => v.toLocaleString("tr-TR") },
  { key: "brut_kar_marji", label: "Brüt Kâr Marjı", format: (v) => `%${(v * 100).toFixed(1)}` },
  { key: "brut_satis_adeti", label: "Brüt Satış Adedi", format: (v) => v.toLocaleString("tr-TR") },
];

const TARIH_ARALIKLARI = [
  { key: "3", label: "Son 3 Ay" },
  { key: "6", label: "Son 6 Ay" },
  { key: "12", label: "Son 12 Ay" },
  { key: "TUMU", label: "Tümü" },
] as const;

// Bağımsız bir grafik paneli — kendi değişken/tarih aralığı seçimini kendi
// içinde tutar, böylece aynı sayfada birden fazla grafik birbirinden bağımsız
// çalışabilir. Hem CikarmaForm hem Personel Listesi popup'ında kullanılır.
export default function KisiGrafikPaneli({
  gecmis, yukleniyor, varsayilanDegisken, hgoYuksek,
}: {
  gecmis: PersonelAylikHgo[]; yukleniyor: boolean; varsayilanDegisken: keyof PersonelAylikHgo; hgoYuksek: boolean;
}) {
  const [degisken, setDegisken] = useState<keyof PersonelAylikHgo>(varsayilanDegisken);
  const [gorunum, setGorunum] = useState<"grafik" | "liste">("grafik");
  const [tarihAraligi, setTarihAraligi] = useState<"3" | "6" | "12" | "TUMU">("12");
  const tanim = KISI_DEGISKENLERI.find((d) => d.key === degisken)!;

  const gecmisFiltrelenmis = useMemo(() => {
    if (tarihAraligi === "TUMU") return gecmis;
    const ayAdedi = Number(tarihAraligi);
    const simdi = new Date();
    const esikDonem = (simdi.getFullYear() * 12 + simdi.getMonth() + 1) - ayAdedi;
    return gecmis.filter((g) => g.yil * 12 + g.ay > esikDonem);
  }, [gecmis, tarihAraligi]);

  const veri = useMemo(
    () => gecmisFiltrelenmis
      .filter((g) => g[degisken] !== null && g[degisken] !== undefined)
      .map((g) => ({ etiket: `${AY_KISA[g.ay]} ${String(g.yil).slice(2)}`, deger: g[degisken] as number })),
    [gecmisFiltrelenmis, degisken]
  );

  const cizgiRengi = degisken === "hgo" && hgoYuksek ? "#B0402E" : degisken === "adet_hgo" ? "#3E7CB1" : "#0F1B4D";

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <div className="text-[11px] font-semibold text-navy-3">{tanim.label} — Aylık</div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            <button onClick={() => setGorunum("grafik")}
              className={`px-1.5 py-0.5 text-[9px] font-medium ${gorunum === "grafik" ? "bg-navy text-white" : "bg-white text-gray-500"}`}>
              Grafik
            </button>
            <button onClick={() => setGorunum("liste")}
              className={`px-1.5 py-0.5 text-[9px] font-medium border-l border-gray-200 ${gorunum === "liste" ? "bg-navy text-white" : "bg-white text-gray-500"}`}>
              Liste
            </button>
          </div>
          <select value={tarihAraligi} onChange={(e) => setTarihAraligi(e.target.value as typeof tarihAraligi)}
            className="border border-gray-300 rounded-md px-1.5 py-1 text-[10px] bg-white">
            {TARIH_ARALIKLARI.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select
            value={degisken}
            onChange={(e) => setDegisken(e.target.value as keyof PersonelAylikHgo)}
            className="border border-gray-300 rounded-md px-1.5 py-1 text-[10px] bg-white"
          >
            {KISI_DEGISKENLERI.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
      </div>
      {yukleniyor ? (
        <div className="text-xs text-gray-400 py-6 text-center">Yükleniyor...</div>
      ) : veri.length === 0 ? (
        <div className="text-xs text-gray-400 py-6 text-center">Veri yok.</div>
      ) : gorunum === "liste" ? (
        <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-md">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase sticky top-0">
                <th className="text-left px-2 py-1.5">Dönem</th>
                <th className="text-right px-2 py-1.5">{tanim.label}</th>
              </tr>
            </thead>
            <tbody>
              {veri.slice().reverse().map((v, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="px-2 py-1.5 text-navy-3 font-medium">{v.etiket}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-gray-700">{tanim.format(v.deger)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={veri} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="etiket" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip formatter={(v: number) => tanim.format(v)} labelStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="deger" stroke={cizgiRengi} strokeWidth={2} dot={{ r: 2.5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
