"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type PerformansSatiri = {
  magaza_id: string; yil: number; ay: number; hgo: number | null;
  sepet_ortalamasi: number | null; sepet_derinligi: number | null; donusum_orani: number | null; giren_musteri_sayisi: number | null;
};

const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const DEGISKENLER: { key: keyof PerformansSatiri; label: string; format: (v: number) => string }[] = [
  { key: "hgo", label: "HGO (Hedef Gerçekleştirme)", format: (v) => `%${v.toFixed(1)}` },
  { key: "sepet_ortalamasi", label: "Sepet Ortalaması", format: (v) => v.toFixed(2) },
  { key: "sepet_derinligi", label: "Sepet Derinliği", format: (v) => v.toFixed(2) },
  { key: "donusum_orani", label: "Dönüşüm Oranı", format: (v) => `%${(v * 100).toFixed(1)}` },
  { key: "giren_musteri_sayisi", label: "Giren Müşteri Sayısı", format: (v) => v.toLocaleString("tr-TR") },
];

export default function DashboardZamanGrafigi({ performansHam }: { performansHam: PerformansSatiri[] }) {
  const [degisken, setDegisken] = useState<keyof PerformansSatiri>("hgo");
  const secilenTanim = DEGISKENLER.find((d) => d.key === degisken)!;

  const veri = useMemo(() => {
    const gruplanmis = new Map<string, { yil: number; ay: number; toplam: number; sayi: number }>();
    performansHam.forEach((p) => {
      const deger = p[degisken];
      if (deger === null || deger === undefined) return;
      const anahtar = `${p.yil}-${String(p.ay).padStart(2, "0")}`;
      if (!gruplanmis.has(anahtar)) gruplanmis.set(anahtar, { yil: p.yil, ay: p.ay, toplam: 0, sayi: 0 });
      const g = gruplanmis.get(anahtar)!;
      g.toplam += deger as number;
      g.sayi += 1;
    });
    return Array.from(gruplanmis.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([anahtar, g]) => ({
        etiket: `${AY_KISA[g.ay]} ${String(g.yil).slice(2)}`,
        deger: g.sayi > 0 ? g.toplam / g.sayi : 0,
      }));
  }, [performansHam, degisken]);

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-navy-3">Zaman İçinde Performans</div>
        <select
          value={degisken}
          onChange={(e) => setDegisken(e.target.value as keyof PerformansSatiri)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
        >
          {DEGISKENLER.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      </div>

      {veri.length === 0 ? (
        <div className="text-xs text-gray-400 py-8 text-center">Henüz performans verisi yok.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={veri} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="etiket" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => secilenTanim.format(v)} labelStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="deger" stroke="#00365a" strokeWidth={2} dot={{ r: 3 }} name={secilenTanim.label} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="text-[10px] text-gray-400 mt-1">Tüm mağazaların (o ay veri girilmiş olanların) ortalaması gösteriliyor.</div>
    </div>
  );
}
