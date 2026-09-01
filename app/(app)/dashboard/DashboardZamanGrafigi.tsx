"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

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

function anahtarUret(yil: number, ay: number) {
  return yil * 100 + ay;
}

export default function DashboardZamanGrafigi({ performansHam }: { performansHam: PerformansSatiri[] }) {
  const [degisken, setDegisken] = useState<keyof PerformansSatiri>("hgo");
  const secilenTanim = DEGISKENLER.find((d) => d.key === degisken)!;

  // Dosyadaki tüm (yıl, ay) çiftlerini kronolojik sırada çıkar — aralık seçicileri bunlardan besleniyor.
  const tumDonemler = useMemo(() => {
    const set = new Set<number>();
    performansHam.forEach((p) => set.add(anahtarUret(p.yil, p.ay)));
    return Array.from(set).sort((a, b) => a - b);
  }, [performansHam]);

  const [baslangic, setBaslangic] = useState<number | null>(null);
  const [bitis, setBitis] = useState<number | null>(null);

  const etkinBaslangic = baslangic ?? (tumDonemler[0] ?? 0);
  const etkinBitis = bitis ?? (tumDonemler[tumDonemler.length - 1] ?? 999999);

  function donemEtiket(anahtar: number) {
    const yil = Math.floor(anahtar / 100);
    const ay = anahtar % 100;
    return `${AY_KISA[ay]} ${yil}`;
  }

  const veri = useMemo(() => {
    const gruplanmis = new Map<string, { yil: number; ay: number; toplam: number; sayi: number }>();
    performansHam.forEach((p) => {
      const anahtar = anahtarUret(p.yil, p.ay);
      if (anahtar < etkinBaslangic || anahtar > etkinBitis) return;
      const deger = p[degisken];
      if (deger === null || deger === undefined) return;
      const grupAnahtari = `${p.yil}-${String(p.ay).padStart(2, "0")}`;
      if (!gruplanmis.has(grupAnahtari)) gruplanmis.set(grupAnahtari, { yil: p.yil, ay: p.ay, toplam: 0, sayi: 0 });
      const g = gruplanmis.get(grupAnahtari)!;
      g.toplam += deger as number;
      g.sayi += 1;
    });
    return Array.from(gruplanmis.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, g]) => ({
        etiket: `${AY_KISA[g.ay]} ${String(g.yil).slice(2)}`,
        deger: g.sayi > 0 ? g.toplam / g.sayi : 0,
      }));
  }, [performansHam, degisken, etkinBaslangic, etkinBitis]);

  const enSonAyOrtalamalari = useMemo(() => {
    if (performansHam.length === 0) return null;
    let enSonYil = 0, enSonAy = 0;
    performansHam.forEach((p) => {
      if (p.yil > enSonYil || (p.yil === enSonYil && p.ay > enSonAy)) { enSonYil = p.yil; enSonAy = p.ay; }
    });

    const buAyVerisi = performansHam.filter((p) => p.yil === enSonYil && p.ay === enSonAy);
    const sonuc: Record<string, { toplam: number; sayi: number }> = {};
    DEGISKENLER.forEach((d) => { sonuc[d.key] = { toplam: 0, sayi: 0 }; });

    buAyVerisi.forEach((p) => {
      DEGISKENLER.forEach((d) => {
        const deger = p[d.key];
        if (deger === null || deger === undefined) return;
        sonuc[d.key].toplam += deger as number;
        sonuc[d.key].sayi += 1;
      });
    });

    return {
      etiket: `${AY_KISA[enSonAy]} ${enSonYil}`,
      magazaSayisi: buAyVerisi.length,
      degerler: DEGISKENLER.map((d) => ({
        ...d,
        ortalama: sonuc[d.key].sayi > 0 ? sonuc[d.key].toplam / sonuc[d.key].sayi : null,
      })),
    };
  }, [performansHam]);

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-sm font-semibold text-navy-3">Zaman İçinde Performans</div>
        <div className="flex items-center gap-2">
          <select
            value={etkinBaslangic}
            onChange={(e) => setBaslangic(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
          >
            {tumDonemler.map((d) => <option key={d} value={d}>{donemEtiket(d)}</option>)}
          </select>
          <span className="text-gray-300 text-xs">–</span>
          <select
            value={etkinBitis}
            onChange={(e) => setBitis(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
          >
            {tumDonemler.map((d) => <option key={d} value={d}>{donemEtiket(d)}</option>)}
          </select>
          <select
            value={degisken}
            onChange={(e) => setDegisken(e.target.value as keyof PerformansSatiri)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
          >
            {DEGISKENLER.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
      </div>

      {veri.length === 0 ? (
        <div className="text-xs text-gray-400 py-8 text-center">Bu aralıkta performans verisi yok.</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={veri} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="etiket" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => secilenTanim.format(v)} labelStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="deger" stroke="#00365a" strokeWidth={2} dot={{ r: 3 }} name={secilenTanim.label}>
              <LabelList
                dataKey="deger"
                position="top"
                style={{ fontSize: 10, fill: "#00365a" }}
                formatter={(v: number) => secilenTanim.format(v)}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="text-[10px] text-gray-400 mt-1">Tüm mağazaların (o ay veri girilmiş olanların) ortalaması gösteriliyor.</div>

      {enSonAyOrtalamalari && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="text-[11px] text-gray-400 mb-2">
            En güncel ay özeti — {enSonAyOrtalamalari.etiket} ({enSonAyOrtalamalari.magazaSayisi} mağaza verisi)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {enSonAyOrtalamalari.degerler.map((d) => (
              <div key={d.key} className="border border-gray-100 rounded-md p-3">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{d.label}</div>
                <div className="text-lg font-mono font-semibold text-navy">
                  {d.ortalama !== null ? d.format(d.ortalama) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
