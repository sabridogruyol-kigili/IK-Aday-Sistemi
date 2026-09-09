"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { MagazaAylikSatiri } from "./actions-magaza-bilgi";

const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const DEGISKENLER: { key: keyof MagazaAylikSatiri; label: string; format: (v: number) => string }[] = [
  { key: "hgo", label: "HGO (Ciro)", format: (v) => `%${v.toFixed(1)}` },
  { key: "adet_hgo", label: "HGO (Adet)", format: (v) => `%${v.toFixed(1)}` },
  { key: "toplam_ciro_kdv_dahil", label: "Toplam Ciro", format: (v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) },
  { key: "satis_adeti", label: "Satış Adedi", format: (v) => v.toLocaleString("tr-TR") },
  { key: "sepet_ortalamasi", label: "Sepet Ortalaması", format: (v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) },
  { key: "sepet_derinligi", label: "Sepet Derinliği", format: (v) => v.toFixed(2) },
  { key: "donusum_orani", label: "Dönüşüm Oranı", format: (v) => `%${v.toFixed(1)}` },
  { key: "giren_musteri_sayisi", label: "Giren Müşteri", format: (v) => v.toLocaleString("tr-TR") },
];

// Mağaza aylık performansını grafik ya da liste (tablo) olarak gösterir,
// değişken dropdown'dan seçilebilir. Yeni Talep formlarındaki mağaza bilgi
// panellerinin tamamında kullanılan ortak bileşen.
export default function MagazaGrafikPaneli({
  aylikVeri, baslik = "Performans", varsayilanDegisken = "hgo",
}: {
  aylikVeri: MagazaAylikSatiri[]; baslik?: string; varsayilanDegisken?: keyof MagazaAylikSatiri;
}) {
  const [degisken, setDegisken] = useState<keyof MagazaAylikSatiri>(varsayilanDegisken);
  const [gorunum, setGorunum] = useState<"grafik" | "liste">("grafik");
  const tanim = DEGISKENLER.find((d) => d.key === degisken)!;

  const veri = useMemo(
    () => aylikVeri
      .filter((s) => s[degisken] !== null && s[degisken] !== undefined)
      .map((s) => ({ etiket: `${AY_KISA[s.ay]} ${String(s.yil).slice(2)}`, deger: s[degisken] as number })),
    [aylikVeri, degisken]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="text-[11px] font-semibold text-navy-3">{baslik}: {tanim.label}</div>
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
          <select value={degisken} onChange={(e) => setDegisken(e.target.value as keyof MagazaAylikSatiri)}
            className="border border-gray-300 rounded-md px-1.5 py-1 text-[10px] bg-white">
            {DEGISKENLER.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
      </div>

      {veri.length === 0 ? (
        <div className="text-xs text-gray-400 py-6 text-center">Veri yok.</div>
      ) : gorunum === "grafik" ? (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={veri} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="etiket" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip formatter={(v: number) => tanim.format(v)} labelStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="deger" stroke="#0F1B4D" strokeWidth={2} dot={{ r: 2.5 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
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
      )}
    </div>
  );
}
