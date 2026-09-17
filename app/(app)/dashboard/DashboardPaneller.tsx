"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { getMagazaCalisanGecmisi, type MagazaCalisanSatiri } from "./actions";
import { useTemaKoyuMu, grafikRenkleri } from "@/lib/useTemaKoyuMu";
import PersonelDetayModal from "../personel/PersonelDetayModal";

type Magaza = {
  id: string; magaza_kodu: string; magaza_adi: string; bolge_id: string | null; bolge_adi: string; il_adi: string | null;
  subetipi: string | null; net_m2: number | null;
  istifa_turnover: number | null; fesih_turnover: number | null; toplam_turnover: number | null;
  magaza_muduru: string | null;
  ana_norm: number; ana_dolu: number; donemsel_norm: number; donemsel_dolu: number;
  part_norm: number; part_dolu: number; toplamNorm: number; toplamDolu: number; oran: number;
};
type Bolge = { id: string; ad: string };
type PerformansSatiri = {
  magaza_id: string; yil: number; ay: number; hgo: number | null;
  sepet_ortalamasi: number | null; sepet_derinligi: number | null; donusum_orani: number | null; giren_musteri_sayisi: number | null;
  adet_hgo: number | null; satis_adeti: number | null; toplam_ciro_kdv_dahil: number | null;
  omnichannel_ciro: number | null; omnichannel_haric_ciro: number | null;
};
const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const ZAMAN_DEGISKENLERI: { key: keyof PerformansSatiri; label: string; format: (v: number) => string }[] = [
  { key: "hgo", label: "HGO (Ciro)", format: (v) => `%${v.toFixed(1)}` },
  { key: "adet_hgo", label: "HGO (Adet)", format: (v) => `%${v.toFixed(1)}` },
  { key: "sepet_ortalamasi", label: "Sepet Ortalaması", format: (v) => v.toFixed(2) },
  { key: "sepet_derinligi", label: "Sepet Derinliği", format: (v) => v.toFixed(2) },
  { key: "donusum_orani", label: "Dönüşüm Oranı", format: (v) => `%${(v * 100).toFixed(1)}` },
  { key: "giren_musteri_sayisi", label: "Giren Müşteri Sayısı", format: (v) => v.toLocaleString("tr-TR") },
  { key: "satis_adeti", label: "Satış Adeti", format: (v) => v.toLocaleString("tr-TR") },
  { key: "toplam_ciro_kdv_dahil", label: "Toplam Ciro (KDV Dahil)", format: (v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) },
  { key: "omnichannel_ciro", label: "Omnichannel Cirosu", format: (v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) },
  { key: "omnichannel_haric_ciro", label: "Omnichannel Hariç Ciro", format: (v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) },
];

function zamanAnahtarUret(yil: number, ay: number) {
  return yil * 100 + ay;
}

type NormDurum = "EKSIK_ANA" | "EKSIK_DIGER" | "TAM" | "FAZLA";
const DURUM_ETIKET: Record<NormDurum, string> = {
  EKSIK_ANA: "Ana Kadro Eksik", EKSIK_DIGER: "Dönemsel/Part Eksik", TAM: "Norm Tam", FAZLA: "Norm Fazla",
};
const DURUM_BORDER: Record<NormDurum, string> = {
  EKSIK_ANA: "border-l-4 border-l-danger", EKSIK_DIGER: "border-l-4 border-l-accent",
  TAM: "border-l-4 border-l-success", FAZLA: "border-l-4 border-l-info",
};
const DURUM_NOKTA: Record<NormDurum, string> = {
  EKSIK_ANA: "bg-danger", EKSIK_DIGER: "bg-accent", TAM: "bg-success", FAZLA: "bg-info",
};

function normDurumu(m: Magaza): NormDurum {
  if (m.ana_dolu < m.ana_norm) return "EKSIK_ANA";
  if (m.donemsel_dolu < m.donemsel_norm || m.part_dolu < m.part_norm) return "EKSIK_DIGER";
  if (m.ana_dolu > m.ana_norm || m.donemsel_dolu > m.donemsel_norm || m.part_dolu > m.part_norm) return "FAZLA";
  return "TAM";
}

function oranHesap(dolu: number, norm: number) {
  return norm > 0 ? Math.min(Math.round((dolu / norm) * 100), 100) : 0;
}

function farkRengi(fark: number): string {
  if (fark < 0) return "text-danger";
  if (fark > 0) return "text-accent";
  return "text-success";
}

// Mağazalarım/Norm sayfasındaki NORM/FİİLİ/FARK üçlü gösterimiyle aynı —
// Dashboard'un sol panelindeki "Liste" görünümünde kullanılıyor.
function KadroGrubuMini({ norm, dolu }: { norm: number; dolu: number }) {
  const fark = dolu - norm;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="text-center">
        <div className="text-[8px] text-gray-400 uppercase">Norm</div>
        <div className="font-mono text-gray-600">{norm}</div>
      </div>
      <div className="text-center">
        <div className="text-[8px] text-gray-400 uppercase">Fiili</div>
        <div className="font-mono text-gray-600">{dolu}</div>
      </div>
      <div className="text-center min-w-[28px]">
        <div className="text-[8px] text-gray-400 uppercase">Fark</div>
        <div className={`font-mono font-bold ${farkRengi(fark)}`}>{fark > 0 ? `+${fark}` : fark}</div>
      </div>
    </div>
  );
}

function hgoRenk(hgo: number) {
  if (hgo < 80) return { bar: "bg-danger", metin: "text-danger" };
  if (hgo <= 100) return { bar: "bg-accent", metin: "text-accent" };
  return { bar: "bg-success", metin: "text-success" };
}

// Mağaza adında genelde marka/kısaltma önekleri sonra il adı gelir (örn. "A.K. İstanbul Carousel").
// Kesin bir "il" alanı DB'de tutulmadığı için en iyi tahminle çıkarım yapıyoruz.
// Tek bir KPI kutusu: mağaza seçiliyse kendi değeri (büyük), altında genel ortalama ve
// aradaki fark (yöne göre yeşil/kırmızı — Turnover gibi "düşük iyi" metriklerde ters renklenir).
function KpiKart({
  label, kendi, ortalama, format, seciliVar, tersYon = false,
}: {
  label: string; kendi: number | null; ortalama: number | null; format: (v: number) => string; seciliVar: boolean; tersYon?: boolean;
}) {
  const anaDeger = seciliVar ? kendi : ortalama;
  const farkGoster = seciliVar && kendi !== null && ortalama !== null;
  const fark = farkGoster ? kendi! - ortalama! : null;
  const iyiMi = fark !== null ? (tersYon ? fark <= 0 : fark >= 0) : null;

  return (
    <div className="bg-gray-50 rounded-lg px-2.5 py-2.5">
      <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-1 leading-tight">{label}</div>
      <div className="text-lg font-mono font-semibold text-navy-3 mb-1">{anaDeger !== null ? format(anaDeger) : "—"}</div>
      {farkGoster ? (
        <div className="space-y-0.5">
          <div className="text-[9px] text-gray-400">Ort: {format(ortalama!)}</div>
          <div className={`text-[10px] font-mono font-semibold ${iyiMi ? "text-success" : "text-danger"}`}>
            {fark! >= 0 ? "▲" : "▼"} {fark! >= 0 ? "+" : ""}{fark!.toFixed(2)}
          </div>
        </div>
      ) : (
        !seciliVar && <div className="text-[9px] text-gray-300">Genel ortalama</div>
      )}
    </div>
  );
}

// KPI bloklarını anlamlı gruplara ayırmak için kullanılan başlık.
function KpiGrupBasligi({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{children}</div>;
}

// Norm/Kadro'nun 4 ayrı kutuya bölünmesi yerine tek kutuda, ünvan gruplarının
// yan yana dizildiği kompakt bir özet — "Toplam" en altta ayrı vurgulanır.
function NormKpiKutusu({
  normKpiOzet, seciliVar,
}: {
  normKpiOzet: { ana: { kendi: number | null; ortalama: number | null }; donemsel: { kendi: number | null; ortalama: number | null }; part: { kendi: number | null; ortalama: number | null }; toplam: { kendi: number | null; ortalama: number | null } };
  seciliVar: boolean;
}) {
  const satirlar: { label: string; data: { kendi: number | null; ortalama: number | null } }[] = [
    { label: "Ana Kadro", data: normKpiOzet.ana },
    { label: "Dönemsel", data: normKpiOzet.donemsel },
    { label: "Part-Time", data: normKpiOzet.part },
  ];
  function deger(d: { kendi: number | null; ortalama: number | null }) {
    const v = seciliVar ? d.kendi : d.ortalama;
    return v !== null ? v.toFixed(0) : "—";
  }
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5">
      <div className="grid grid-cols-3 divide-x divide-gray-200">
        {satirlar.map((s) => (
          <div key={s.label} className="px-2.5 first:pl-0 text-center">
            <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-1 leading-tight">{s.label}</div>
            <div className="text-base font-mono font-semibold text-navy-3">{deger(s.data)}</div>
            {seciliVar && s.data.kendi !== null && s.data.ortalama !== null && (
              <div className="text-[9px] text-gray-400 mt-0.5">Ort: {s.data.ortalama.toFixed(0)}</div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2.5 pt-2 border-t border-gray-200 flex items-center justify-between">
        <span className="text-[9px] text-gray-400 uppercase tracking-wide">Toplam Norm</span>
        <span className="text-base font-mono font-semibold text-navy">{deger(normKpiOzet.toplam)}</span>
      </div>
    </div>
  );
}

// "Zaman İçinde Performans" grafiği — kendi değişken/dönem seçimini kendi içinde
// tutar, böylece aynı sayfada birbirinden bağımsız birden fazla örneği kullanılabilir.
// Karşılaştırma çizgileri için sabit renk/anahtar sırası — en fazla 3 ek mağaza.
const EK_MAGAZA_LIMIT = 3;

function ZamanGrafigi({
  performansHam, seciliMagaza, seciliMagazaId, varsayilanDegisken, magazalar,
}: {
  performansHam: PerformansSatiri[]; seciliMagaza: Magaza | null; seciliMagazaId: string | null; varsayilanDegisken: keyof PerformansSatiri;
  magazalar: Magaza[];
}) {
  const [zamanDegisken, setZamanDegisken] = useState<keyof PerformansSatiri>(varsayilanDegisken);
  const zamanTanim = ZAMAN_DEGISKENLERI.find((d) => d.key === zamanDegisken)!;
  const koyuMu = useTemaKoyuMu();
  const rk = grafikRenkleri(koyuMu);
  const ekRenkler = [rk.info, rk.accent, rk.success];

  const [ekMagazaIdler, setEkMagazaIdler] = useState<string[]>([]);
  const [ekSeciciAcik, setEkSeciciAcik] = useState(false);
  const ekSeciciRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function disaTikla(e: MouseEvent) { if (ekSeciciRef.current && !ekSeciciRef.current.contains(e.target as Node)) setEkSeciciAcik(false); }
    document.addEventListener("mousedown", disaTikla);
    return () => document.removeEventListener("mousedown", disaTikla);
  }, []);
  function ekMagazaToggle(id: string) {
    setEkMagazaIdler((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= EK_MAGAZA_LIMIT) return prev;
      return [...prev, id];
    });
  }
  const magazaMapYerel = useMemo(() => {
    const m: Record<string, Magaza> = {};
    magazalar.forEach((mag) => { m[mag.id] = mag; });
    return m;
  }, [magazalar]);

  const tumDonemler = useMemo(() => {
    const set = new Set<number>();
    performansHam.forEach((p) => set.add(zamanAnahtarUret(p.yil, p.ay)));
    return Array.from(set).sort((a, b) => a - b);
  }, [performansHam]);

  const [zamanBaslangic, setZamanBaslangic] = useState<number | null>(null);
  const [zamanBitis, setZamanBitis] = useState<number | null>(null);
  const etkinBaslangic = zamanBaslangic ?? (tumDonemler[0] ?? 0);
  const etkinBitis = zamanBitis ?? (tumDonemler[tumDonemler.length - 1] ?? 999999);

  function donemEtiket(anahtar: number) {
    return `${AY_KISA[anahtar % 100]} ${Math.floor(anahtar / 100)}`;
  }

  const zamanVeri = useMemo(() => {
    const ortalamaMap = new Map<string, { yil: number; ay: number; toplam: number; sayi: number }>();
    const seciliMap = new Map<string, number>();
    // ekMap[magazaId] -> (grupAnahtari -> değer)
    const ekMap = new Map<string, Map<string, number>>();
    ekMagazaIdler.forEach((id) => ekMap.set(id, new Map()));

    performansHam.forEach((p) => {
      const anahtar = zamanAnahtarUret(p.yil, p.ay);
      if (anahtar < etkinBaslangic || anahtar > etkinBitis) return;
      const deger = p[zamanDegisken];
      if (deger === null || deger === undefined) return;
      const grupAnahtari = `${p.yil}-${String(p.ay).padStart(2, "0")}`;

      if (!ortalamaMap.has(grupAnahtari)) ortalamaMap.set(grupAnahtari, { yil: p.yil, ay: p.ay, toplam: 0, sayi: 0 });
      const g = ortalamaMap.get(grupAnahtari)!;
      g.toplam += deger as number;
      g.sayi += 1;

      if (seciliMagazaId && p.magaza_id === seciliMagazaId) seciliMap.set(grupAnahtari, deger as number);
      if (ekMap.has(p.magaza_id)) ekMap.get(p.magaza_id)!.set(grupAnahtari, deger as number);
    });

    return Array.from(ortalamaMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([grupAnahtari, g]) => {
        const satir: Record<string, string | number | null> = {
          etiket: `${AY_KISA[g.ay]} ${String(g.yil).slice(2)}`,
          ortalama: g.sayi > 0 ? g.toplam / g.sayi : null,
          secili: seciliMap.has(grupAnahtari) ? seciliMap.get(grupAnahtari)! : null,
        };
        ekMagazaIdler.forEach((id, i) => {
          satir[`ek${i}`] = ekMap.get(id)?.get(grupAnahtari) ?? null;
        });
        return satir;
      });
  }, [performansHam, zamanDegisken, etkinBaslangic, etkinBitis, seciliMagazaId, ekMagazaIdler]);

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-sm font-semibold text-navy-3">
          Zaman İçinde Performans
          {seciliMagaza && <span className="text-gray-400 font-normal"> — {seciliMagaza.magaza_adi} vs. Tüm Mağaza Ortalaması</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={ekSeciciRef}>
            <button type="button" onClick={() => setEkSeciciAcik((v) => !v)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white flex items-center gap-1.5">
              <span className={ekMagazaIdler.length === 0 ? "text-gray-500" : "text-navy-3"}>
                {ekMagazaIdler.length === 0 ? "Mağaza Karşılaştır" : `${ekMagazaIdler.length} mağaza seçili`}
              </span>
              <span className={`text-[8px] text-gray-400 transition-transform ${ekSeciciAcik ? "rotate-180" : ""}`}>▼</span>
            </button>
            <div className={`absolute z-20 mt-1 w-56 bg-white border border-gray-300 rounded-md shadow-lg max-h-56 overflow-y-auto divide-y divide-gray-100 ${ekSeciciAcik ? "block" : "hidden"}`}>
              {ekMagazaIdler.length > 0 && (
                <button onClick={() => setEkMagazaIdler([])} className="w-full text-left text-[11px] text-info px-2.5 py-1.5 hover:bg-gray-50">Seçimi temizle</button>
              )}
              <div className="px-2.5 py-1 text-[9px] text-gray-400">En fazla {EK_MAGAZA_LIMIT} mağaza seçilebilir</div>
              {magazalar.map((m) => {
                const seciliMi = ekMagazaIdler.includes(m.id);
                const limitDoldu = !seciliMi && ekMagazaIdler.length >= EK_MAGAZA_LIMIT;
                return (
                  <label key={m.id} className={`flex items-center gap-2 text-[11px] px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer ${limitDoldu ? "opacity-40 cursor-not-allowed" : "text-gray-600"}`}>
                    <input type="checkbox" checked={seciliMi} disabled={limitDoldu} onChange={() => ekMagazaToggle(m.id)} />
                    {m.magaza_adi}
                  </label>
                );
              })}
            </div>
          </div>
          <select value={etkinBaslangic} onChange={(e) => setZamanBaslangic(Number(e.target.value))} className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
            {tumDonemler.map((d) => <option key={d} value={d}>{donemEtiket(d)}</option>)}
          </select>
          <span className="text-gray-300 text-xs">–</span>
          <select value={etkinBitis} onChange={(e) => setZamanBitis(Number(e.target.value))} className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
            {tumDonemler.map((d) => <option key={d} value={d}>{donemEtiket(d)}</option>)}
          </select>
          <select value={zamanDegisken} onChange={(e) => setZamanDegisken(e.target.value as keyof PerformansSatiri)} className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
            {ZAMAN_DEGISKENLERI.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
      </div>

      {zamanVeri.length === 0 ? (
        <div className="text-xs text-gray-400 py-8 text-center">Bu aralıkta performans verisi yok.</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={zamanVeri} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={rk.izgara} />
            <XAxis dataKey="etiket" tick={{ fontSize: 11, fill: rk.eksenMetni }} />
            <YAxis tick={{ fontSize: 11, fill: rk.eksenMetni }} />
            <Tooltip formatter={(v: number) => zamanTanim.format(v)} labelStyle={{ fontSize: 12, color: rk.tooltipMetin }} contentStyle={{ backgroundColor: rk.tooltipBg, borderColor: rk.tooltipBorder }} />
            <Legend wrapperStyle={{ fontSize: 11, color: rk.eksenMetni }} />
            <Line type="monotone" dataKey="ortalama" stroke={rk.ortalamaCizgi} strokeWidth={2} dot={{ r: 2 }} name="Tüm Mağaza Ortalaması" connectNulls>
              {!seciliMagaza && (
                <LabelList dataKey="ortalama" position="top" style={{ fontSize: 10, fill: rk.eksenMetni }} formatter={(v: number) => zamanTanim.format(v)} />
              )}
            </Line>
            {seciliMagaza && (
              <Line type="monotone" dataKey="secili" stroke={rk.navy} strokeWidth={2.5} dot={{ r: 3 }} name={seciliMagaza.magaza_adi} connectNulls>
                <LabelList dataKey="secili" position="top" style={{ fontSize: 10, fill: rk.navy }} formatter={(v: number) => zamanTanim.format(v)} />
              </Line>
            )}
            {ekMagazaIdler.map((id, i) => (
              <Line key={id} type="monotone" dataKey={`ek${i}`} stroke={ekRenkler[i % ekRenkler.length]} strokeWidth={2} dot={{ r: 2.5 }}
                name={magazaMapYerel[id]?.magaza_adi ?? "Mağaza"} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="text-[10px] text-gray-400 mt-1">
        {ekMagazaIdler.length > 0
          ? "Gri çizgi tüm mağaza ortalaması, renkli çizgiler seçtiğiniz mağazalar."
          : seciliMagaza
          ? "Gri çizgi tüm mağazaların ortalaması, lacivert çizgi seçili mağaza — üstünde/altında olması karşılaştırma sağlar."
          : "Soldaki listeden bir mağaza seçerseniz, o mağazanın çizgisi tüm mağaza ortalamasıyla birlikte gösterilir. \"Mağaza Karşılaştır\" ile en fazla 3 mağaza daha ekleyebilirsiniz."}
      </div>
    </div>
  );
}

function BolgeDropdownFiltre({ bolgeler, secilenler, setSecilenler }: { bolgeler: Bolge[]; secilenler: Set<string>; setSecilenler: (s: Set<string>) => void }) {
  const [acik, setAcik] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function disaTikla(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false); }
    document.addEventListener("mousedown", disaTikla);
    return () => document.removeEventListener("mousedown", disaTikla);
  }, []);
  function toggle(id: string) {
    const yeni = new Set(secilenler);
    if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
    setSecilenler(yeni);
  }
  const etiket = secilenler.size === 0 ? "Tüm Bölgeler" : secilenler.size === 1 ? bolgeler.find((b) => secilenler.has(b.id))?.ad ?? "1 bölge" : `${secilenler.size} bölge seçili`;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setAcik((v) => !v)}
        className="border border-gray-300 rounded-md px-2 py-1 text-[11px] bg-white flex items-center gap-1.5 min-w-[120px] justify-between">
        <span className={secilenler.size === 0 ? "text-gray-500" : "text-navy-3"}>{etiket}</span>
        <span className={`text-[8px] text-gray-400 transition-transform ${acik ? "rotate-180" : ""}`}>▼</span>
      </button>
      <div className={`absolute z-20 mt-1 w-52 bg-white border border-gray-300 rounded-md shadow-lg max-h-52 overflow-y-auto divide-y divide-gray-100 ${acik ? "block" : "hidden"}`}>
        {secilenler.size > 0 && (
          <button onClick={() => setSecilenler(new Set())} className="w-full text-left text-[11px] text-info px-2.5 py-1.5 hover:bg-gray-50">Seçimi temizle</button>
        )}
        {bolgeler.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-[11px] text-gray-600 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={secilenler.has(b.id)} onChange={() => toggle(b.id)} />
            {b.ad}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPaneller({ magazalar, bolgeler, performansHam, calisanOzetMap }: { magazalar: Magaza[]; bolgeler: Bolge[]; performansHam: PerformansSatiri[]; calisanOzetMap: Record<string, { calisanSayisi: number; satisYapan: number }> }) {
  // ---- Sol panel (Mağazalar) filtreleri ----
  const [solBolgeler, setSolBolgeler] = useState<Set<string>>(new Set());
  const [solArama, setSolArama] = useState("");
  const [normMin, setNormMin] = useState("");
  const [normMax, setNormMax] = useState("");
  const [durumFiltre, setDurumFiltre] = useState<Set<NormDurum>>(new Set());
  const [sadeceKapaliGoster, setSadeceKapaliGoster] = useState(false);
  const [solGorunum, setSolGorunum] = useState<"kart" | "liste">("kart");

  // Bir mağaza, sistemdeki EN GÜNCEL dönemde (tüm veri setindeki en son yıl-ay)
  // Mağaza Performans verisi yoksa "Kapalı" sayılır — mağazanın kendisi aktif/pasif
  // olarak işaretli olsa bile, bu sadece görsel bir uyarıdır, veritabanına dokunmaz.
  const kapaliMagazaIdSet = useMemo(() => {
    let enSonYil = 0, enSonAy = 0;
    performansHam.forEach((p) => {
      if (p.yil > enSonYil || (p.yil === enSonYil && p.ay > enSonAy)) { enSonYil = p.yil; enSonAy = p.ay; }
    });
    if (enSonYil === 0) return new Set<string>();
    const veriOlanlar = new Set(performansHam.filter((p) => p.yil === enSonYil && p.ay === enSonAy).map((p) => p.magaza_id));
    return new Set(magazalar.filter((m) => !veriOlanlar.has(m.id)).map((m) => m.id));
  }, [performansHam, magazalar]);

  const acikMagazaSayisi = magazalar.length - kapaliMagazaIdSet.size;

  // ---- Sağ panel (Performans) filtreleri ----
  const [sagBolgeler, setSagBolgeler] = useState<Set<string>>(new Set());
  const [hgoMin, setHgoMin] = useState("");
  const [hgoMax, setHgoMax] = useState("");
  const [yilFiltre, setYilFiltre] = useState("");
  const [ayFiltre, setAyFiltre] = useState("");

  const [seciliMagazaId, setSeciliMagazaId] = useState<string | null>(null);
  const [detayPersonel, setDetayPersonel] = useState<{ id: string; adSoyad: string; unvan: string } | null>(null);

  // "Mağazalar — Performans" kutusundaki KPI'lar için elle dönem seçimi (null ise
  // otomatik en güncel dönem kullanılır).
  const [kpiDonemManuel, setKpiDonemManuel] = useState<number | null>(null);
  const kpiDonemSecenekleri = useMemo(() => {
    const set = new Set<number>();
    performansHam.forEach((p) => set.add(p.yil * 100 + p.ay));
    return Array.from(set).sort((a, b) => b - a);
  }, [performansHam]);

  const magazaMap = useMemo(() => {
    const m: Record<string, Magaza> = {};
    magazalar.forEach((mag) => { m[mag.id] = mag; });
    return m;
  }, [magazalar]);

  function durumToggle(d: NormDurum) {
    const yeni = new Set(durumFiltre);
    if (yeni.has(d)) yeni.delete(d); else yeni.add(d);
    setDurumFiltre(yeni);
  }

  const solFiltrelenmis = magazalar.filter((m) => {
    if (solBolgeler.size > 0 && (!m.bolge_id || !solBolgeler.has(m.bolge_id))) return false;
    if (solArama && !`${m.magaza_kodu} ${m.magaza_adi}`.toLocaleLowerCase("tr-TR").includes(solArama.toLocaleLowerCase("tr-TR"))) return false;
    if (normMin !== "" && m.toplamNorm < Number(normMin)) return false;
    if (normMax !== "" && m.toplamNorm > Number(normMax)) return false;
    if (durumFiltre.size > 0 && !durumFiltre.has(normDurumu(m))) return false;
    // Varsayılan: sadece açık mağazalar görünür. "Kapalı" butonuna basılınca bu tersine
    // döner, sadece kapalı mağazalar gösterilir.
    if (sadeceKapaliGoster ? !kapaliMagazaIdSet.has(m.id) : kapaliMagazaIdSet.has(m.id)) return false;
    return true;
  });

  const yilSecenekleri = Array.from(new Set(performansHam.map((p) => p.yil))).sort((a, b) => b - a);
  const aySecenekleri = Array.from(new Set(performansHam.map((p) => p.ay))).sort((a, b) => a - b);

  const sagFiltrelenmisHam = performansHam.filter((p) => {
    if (p.hgo === null) return false;
    const magaza = magazaMap[p.magaza_id];
    if (!magaza) return false;
    if (sagBolgeler.size > 0 && (!magaza.bolge_id || !sagBolgeler.has(magaza.bolge_id))) return false;
    if (hgoMin !== "" && p.hgo < Number(hgoMin)) return false;
    if (hgoMax !== "" && p.hgo > Number(hgoMax)) return false;
    if (yilFiltre !== "" && p.yil !== Number(yilFiltre)) return false;
    if (ayFiltre !== "" && p.ay !== Number(ayFiltre)) return false;
    return true;
  });

  // Seçili mağaza yoksa: her mağaza için (filtreye uyan aylar içinden) en güncel ay gösterilir.
  const listeGorunumu = useMemo(() => {
    const enSon: Record<string, PerformansSatiri> = {};
    sagFiltrelenmisHam.forEach((p) => {
      const mevcut = enSon[p.magaza_id];
      if (!mevcut || p.yil > mevcut.yil || (p.yil === mevcut.yil && p.ay > mevcut.ay)) enSon[p.magaza_id] = p;
    });
    return Object.values(enSon).sort((a, b) => (b.hgo ?? 0) - (a.hgo ?? 0));
  }, [sagFiltrelenmisHam]);

  // Seçili mağaza varsa: o mağazanın (filtreye uyan) tüm ayları, en yeniden eskiye.
  const detayGorunumu = useMemo(() => {
    if (!seciliMagazaId) return [];
    return sagFiltrelenmisHam
      .filter((p) => p.magaza_id === seciliMagazaId)
      .sort((a, b) => (b.yil - a.yil) || (b.ay - a.ay));
  }, [sagFiltrelenmisHam, seciliMagazaId]);

  const seciliMagaza = seciliMagazaId ? magazaMap[seciliMagazaId] : null;

  // ---- Zaman İçinde Performans grafiği ----
  const enSonAyOzeti = useMemo(() => {
    if (performansHam.length === 0) return null;

    let enSonYil = 0, enSonAy = 0;

    if (kpiDonemManuel !== null) {
      // Kullanıcı elle bir dönem seçmiş — o dönem kullanılır.
      enSonYil = Math.floor(kpiDonemManuel / 100);
      enSonAy = kpiDonemManuel % 100;
    } else if (seciliMagazaId) {
      // Mağaza seçiliyse referans dönem o mağazanın KENDİ en güncel ayı — başka bir
      // mağazada daha yeni bir ay varsa bile bu mağazanın kendi geçmişi kaybolmasın.
      performansHam.forEach((p) => {
        if (p.magaza_id !== seciliMagazaId) return;
        if (p.yil > enSonYil || (p.yil === enSonYil && p.ay > enSonAy)) { enSonYil = p.yil; enSonAy = p.ay; }
      });
      if (enSonYil === 0) return null; // bu mağaza için hiç veri yok
    } else {
      // Mağaza seçili değilse tüm veri setindeki en güncel ay kullanılır.
      performansHam.forEach((p) => {
        if (p.yil > enSonYil || (p.yil === enSonYil && p.ay > enSonAy)) { enSonYil = p.yil; enSonAy = p.ay; }
      });
    }

    const buAyVerisi = performansHam.filter((p) => p.yil === enSonYil && p.ay === enSonAy);
    if (buAyVerisi.length === 0) return null;

    const toplamlar: Record<string, { toplam: number; sayi: number }> = {};
    ZAMAN_DEGISKENLERI.forEach((d) => { toplamlar[d.key] = { toplam: 0, sayi: 0 }; });
    buAyVerisi.forEach((p) => {
      ZAMAN_DEGISKENLERI.forEach((d) => {
        const deger = p[d.key];
        if (deger === null || deger === undefined) return;
        toplamlar[d.key].toplam += deger as number;
        toplamlar[d.key].sayi += 1;
      });
    });

    const kendiSatir = seciliMagazaId ? buAyVerisi.find((p) => p.magaza_id === seciliMagazaId) ?? null : null;

    return {
      etiket: `${AY_KISA[enSonAy]} ${enSonYil}`,
      magazaSayisi: buAyVerisi.length,
      degerler: ZAMAN_DEGISKENLERI.map((d) => {
        const ortalama = toplamlar[d.key].sayi > 0 ? toplamlar[d.key].toplam / toplamlar[d.key].sayi : null;
        const kendi = kendiSatir ? (kendiSatir[d.key] as number | null) : null;
        return { ...d, ortalama, kendi };
      }),
    };
  }, [performansHam, seciliMagazaId, kpiDonemManuel]);

  // Turnover kümülatif bir bilgi (aylık değil, mağaza başına tek değer) — düşük olması iyi, o yüzden
  // fark renklendirmesi diğer metriklerin tersi (fark pozitifse kırmızı, negatifse yeşil).
  const turnoverOzet = useMemo(() => {
    const gecerliler = magazalar.filter((m) => m.toplam_turnover !== null || m.istifa_turnover !== null || m.fesih_turnover !== null);
    if (gecerliler.length === 0) return null;
    const ortalama = (alan: "istifa_turnover" | "fesih_turnover" | "toplam_turnover") => {
      const degerler = gecerliler.map((m) => m[alan]).filter((v): v is number => v !== null);
      return degerler.length > 0 ? degerler.reduce((s, v) => s + v, 0) / degerler.length : null;
    };
    return {
      istifa: { ortalama: ortalama("istifa_turnover"), kendi: seciliMagaza?.istifa_turnover ?? null },
      fesih: { ortalama: ortalama("fesih_turnover"), kendi: seciliMagaza?.fesih_turnover ?? null },
      toplam: { ortalama: ortalama("toplam_turnover"), kendi: seciliMagaza?.toplam_turnover ?? null },
    };
  }, [magazalar, seciliMagaza]);

  const normKpiOzet = useMemo(() => {
    const ortalama = (alan: "ana_norm" | "donemsel_norm" | "part_norm" | "toplamNorm") =>
      magazalar.length > 0 ? magazalar.reduce((s, m) => s + m[alan], 0) / magazalar.length : null;
    return {
      ana: { kendi: seciliMagaza?.ana_norm ?? null, ortalama: ortalama("ana_norm") },
      donemsel: { kendi: seciliMagaza?.donemsel_norm ?? null, ortalama: ortalama("donemsel_norm") },
      part: { kendi: seciliMagaza?.part_norm ?? null, ortalama: ortalama("part_norm") },
      toplam: { kendi: seciliMagaza?.toplamNorm ?? null, ortalama: ortalama("toplamNorm") },
    };
  }, [magazalar, seciliMagaza]);

  // ---- Çalışan sayısı / satış yapan çalışan oranı (kişi bazlı performanstan) ----
  // Not: performans_kisi_aylik satırında mağaza bilgisi yok, personelin GÜNCEL
  // mağazası üzerinden eşleştiriliyor (geçmiş bir ay için o kişi başka bir
  // mağazadaysa bu yaklaşık bir değerdir, ama elimizdeki en iyi veri budur).
  // ---- Çalışan Sayısı / Satış Yapan Oranı KPI'ları — sunucuda (page.tsx)
  // sadece EN GÜNCEL dönem için önceden hesaplanmış hafif bir özet kullanılır.
  const calisanKpiOzet = useMemo(() => {
    const tumMagazalar = Object.values(calisanOzetMap);
    if (tumMagazalar.length === 0) return null;
    const ortalamaCalisan = tumMagazalar.reduce((s, m) => s + m.calisanSayisi, 0) / tumMagazalar.length;
    const ortalamaSatisYapan = tumMagazalar.reduce((s, m) => s + m.satisYapan, 0) / tumMagazalar.length;
    const oranlar = tumMagazalar.filter((m) => m.calisanSayisi > 0).map((m) => (m.satisYapan / m.calisanSayisi) * 100);
    const ortalamaOran = oranlar.length > 0 ? oranlar.reduce((s, v) => s + v, 0) / oranlar.length : null;

    const kendiMetrik = seciliMagazaId ? calisanOzetMap[seciliMagazaId] : null;
    const kendiOran = kendiMetrik && kendiMetrik.calisanSayisi > 0 ? (kendiMetrik.satisYapan / kendiMetrik.calisanSayisi) * 100 : null;

    return {
      calisanSayisi: { kendi: kendiMetrik?.calisanSayisi ?? null, ortalama: ortalamaCalisan },
      satisYapan: { kendi: kendiMetrik?.satisYapan ?? null, ortalama: ortalamaSatisYapan },
      oran: { kendi: kendiOran, ortalama: ortalamaOran },
    };
  }, [calisanOzetMap, seciliMagazaId]);

  // ---- Seçili mağazanın çalışan listesi (dönem seçilebilir) ----
  // Performans açısından, mağaza seçilene kadar hiçbir kişi bazlı veri çekilmez;
  // seçilince SADECE o mağazanın personelinin geçmişi anlık (on-demand) çekilir.
  const [magazaCalisanGecmisi, setMagazaCalisanGecmisi] = useState<MagazaCalisanSatiri[]>([]);
  const [calisanGecmisiYukleniyor, setCalisanGecmisiYukleniyor] = useState(false);

  useEffect(() => {
    if (!seciliMagazaId) { setMagazaCalisanGecmisi([]); return; }
    setCalisanGecmisiYukleniyor(true);
    getMagazaCalisanGecmisi(seciliMagazaId).then((veri) => {
      setMagazaCalisanGecmisi(veri);
      setCalisanGecmisiYukleniyor(false);
    });
  }, [seciliMagazaId]);

  const magazaDonemSecenekleri = useMemo(() => {
    const set = new Set<number>();
    magazaCalisanGecmisi.forEach((s) => set.add(s.yil * 100 + s.ay));
    return Array.from(set).sort((a, b) => b - a);
  }, [magazaCalisanGecmisi]);

  const [calisanListesiDonem, setCalisanListesiDonem] = useState<number | null>(null);

  useEffect(() => {
    // Mağaza değişince, o mağazanın kendi en güncel dönemine sıfırla.
    setCalisanListesiDonem(magazaDonemSecenekleri[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seciliMagazaId, magazaCalisanGecmisi]);

  const calisanListesi = useMemo(() => {
    if (calisanListesiDonem === null) return [];
    return magazaCalisanGecmisi
      .filter((s) => s.yil * 100 + s.ay === calisanListesiDonem)
      .map((s) => ({ personel_id: s.personel_id, ad_soyad: s.ad_soyad, unvan: s.guncel_unvan, hgo: s.hgo }))
      .sort((a, b) => (b.hgo ?? -Infinity) - (a.hgo ?? -Infinity));
  }, [magazaCalisanGecmisi, calisanListesiDonem]);

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* SOL PANEL — Mağazalar */}
      <div className="bg-white border border-gray-200 rounded-card p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-navy-3">Mağazalar — Norm Doluluk</div>
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-md overflow-hidden shrink-0">
              <button
                onClick={() => setSolGorunum("kart")}
                title="Kart görünümü"
                className={`px-2 py-1 text-[10px] font-medium transition-colors ${solGorunum === "kart" ? "bg-navy text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                ▦ Kart
              </button>
              <button
                onClick={() => setSolGorunum("liste")}
                title="Liste görünümü"
                className={`px-2 py-1 text-[10px] font-medium border-l border-gray-200 transition-colors ${solGorunum === "liste" ? "bg-navy text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                ☰ Liste
              </button>
            </div>
            <div className="text-[11px] text-gray-400 whitespace-nowrap">
              {sadeceKapaliGoster
                ? `${solFiltrelenmis.length} kapalı mağaza`
                : solFiltrelenmis.length === acikMagazaSayisi
                  ? `${acikMagazaSayisi} açık mağaza`
                  : `${solFiltrelenmis.length} / ${acikMagazaSayisi} açık mağaza`}
            </div>
          </div>
        </div>
        <div className="text-[10px] text-gray-400 mb-2">Bir mağazaya tıklayınca sağda o mağazanın performans geçmişi görünür.</div>

        <div className="flex flex-wrap gap-2 mb-2 items-center">
          <input value={solArama} onChange={(e) => setSolArama(e.target.value)} placeholder="Mağaza kodu/adı ara..."
            className="border border-gray-300 rounded-md px-2 py-1 text-[11px] w-40" />
          <BolgeDropdownFiltre bolgeler={bolgeler} secilenler={solBolgeler} setSecilenler={setSolBolgeler} />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">Norm</span>
            <input type="number" value={normMin} onChange={(e) => setNormMin(e.target.value)} placeholder="min" className="w-12 border border-gray-300 rounded-md px-1 py-1 text-[11px]" />
            <span className="text-gray-300 text-[10px]">–</span>
            <input type="number" value={normMax} onChange={(e) => setNormMax(e.target.value)} placeholder="max" className="w-12 border border-gray-300 rounded-md px-1 py-1 text-[11px]" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {(Object.keys(DURUM_ETIKET) as NormDurum[]).map((d) => (
            <button
              key={d}
              onClick={() => durumToggle(d)}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] border ${
                durumFiltre.has(d) ? "border-navy bg-navy/5 text-navy-3 font-medium" : "border-gray-200 text-gray-500"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${DURUM_NOKTA[d]}`} />
              {DURUM_ETIKET[d]}
            </button>
          ))}
          <button
            onClick={() => setSadeceKapaliGoster((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] border ${
              sadeceKapaliGoster ? "border-navy bg-navy/5 text-navy-3 font-medium" : "border-gray-200 text-gray-500"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Kapalı ({kapaliMagazaIdSet.size})
          </button>
        </div>

        {solFiltrelenmis.length === 0 ? (
          <div className="text-xs text-gray-400">Bu filtreye uyan mağaza yok.</div>
        ) : solGorunum === "liste" ? (
          <div className="overflow-y-auto overflow-x-auto pr-1 max-h-[760px] border border-gray-100 rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-[10px] text-navy-3/70 uppercase tracking-wide border-b-2 border-navy">
                  <th className="text-left p-2">Mağaza</th>
                  <th className="text-center p-2 border-l border-gray-100">Ana Kadro</th>
                  <th className="text-center p-2 border-l border-gray-100">Dönemsel</th>
                  <th className="text-center p-2 border-l border-gray-100">Part-Time</th>
                  <th className="text-center p-2 border-l border-gray-100 bg-gray-100/60">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {solFiltrelenmis.map((m) => {
                  const durum = normDurumu(m);
                  const secili = seciliMagazaId === m.id;
                  const kapali = kapaliMagazaIdSet.has(m.id);
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSeciliMagazaId(secili ? null : m.id)}
                      className={`border-t border-gray-100 cursor-pointer transition-colors ${kapali ? "opacity-50 grayscale" : ""} ${secili ? "bg-navy/5" : "hover:bg-gray-50"}`}
                    >
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DURUM_NOKTA[durum]}`} />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-navy-3 truncate">{m.magaza_adi}</div>
                            <div className="text-[9px] text-gray-400 truncate">{m.bolge_adi || "—"}</div>
                          </div>
                          {kapali && <span className="text-[8px] bg-gray-500 text-white rounded-full px-1.5 py-0.5 font-medium shrink-0">Kapalı</span>}
                        </div>
                      </td>
                      <td className="p-2 border-l border-gray-50"><KadroGrubuMini norm={m.ana_norm} dolu={m.ana_dolu} /></td>
                      <td className="p-2 border-l border-gray-50"><KadroGrubuMini norm={m.donemsel_norm} dolu={m.donemsel_dolu} /></td>
                      <td className="p-2 border-l border-gray-50"><KadroGrubuMini norm={m.part_norm} dolu={m.part_dolu} /></td>
                      <td className="p-2 border-l border-gray-50 bg-gray-50/60"><KadroGrubuMini norm={m.toplamNorm} dolu={m.toplamDolu} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto pr-1 max-h-[760px]">
            {solFiltrelenmis.map((m) => {
              const durum = normDurumu(m);
              const secili = seciliMagazaId === m.id;
              const kapali = kapaliMagazaIdSet.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => setSeciliMagazaId(secili ? null : m.id)}
                  className={`text-left border border-gray-100 ${DURUM_BORDER[durum]} rounded-md p-2 transition-colors relative ${
                    kapali ? "opacity-50 grayscale" : ""
                  } ${secili ? "bg-navy/5 ring-1 ring-navy" : "hover:bg-gray-50"}`}
                  title={`${m.magaza_adi} — ${m.bolge_adi}${kapali ? " (Kapalı — güncel dönemde performans verisi yok)" : ` (${DURUM_ETIKET[durum]})`}`}
                >
                  {kapali && (
                    <span className="absolute top-1 right-1 text-[8px] bg-gray-500 text-white rounded-full px-1.5 py-0.5 font-medium">
                      Kapalı
                    </span>
                  )}
                  <div className="text-[11px] text-gray-700 truncate mb-0.5 font-medium">{m.magaza_adi}</div>
                  <div className="text-[9px] text-gray-400 truncate mb-1.5">{m.bolge_adi || "—"}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-navy rounded-full" style={{ width: `${oranHesap(m.ana_dolu, m.ana_norm)}%` }} />
                      </div>
                      <span className="text-[8px] text-gray-400 font-mono w-14 text-right shrink-0">Ana {m.ana_dolu}/{m.ana_norm}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${oranHesap(m.donemsel_dolu, m.donemsel_norm)}%` }} />
                      </div>
                      <span className="text-[8px] text-gray-400 font-mono w-14 text-right shrink-0">Dön. {m.donemsel_dolu}/{m.donemsel_norm}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-info rounded-full" style={{ width: `${oranHesap(m.part_dolu, m.part_norm)}%` }} />
                      </div>
                      <span className="text-[8px] text-gray-400 font-mono w-14 text-right shrink-0">P.T. {m.part_dolu}/{m.part_norm}</span>
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-400 font-mono mt-1.5">Toplam: {m.toplamDolu}/{m.toplamNorm} (%{m.oran})</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SAĞ PANEL — Performans */}
      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-navy-3 flex items-center gap-2">
            {seciliMagaza ? `Performans — ${seciliMagaza.magaza_adi}` : "Mağazalar — Performans (HGO)"}
            {seciliMagaza && kapaliMagazaIdSet.has(seciliMagaza.id) && (
              <span className="text-[9px] bg-gray-500 text-white rounded-full px-1.5 py-0.5 font-medium">Kapalı</span>
            )}
          </div>
          {seciliMagaza && (
            <button onClick={() => setSeciliMagazaId(null)} className="text-[11px] font-medium bg-white border border-info/40 text-info hover:bg-info/5 rounded-md px-2 py-1 transition-colors">◀ Tüm Mağazalar</button>
          )}
        </div>

        {seciliMagaza && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 bg-gray-50 rounded-md p-2.5 text-[11px]">
            <div><div className="text-[9px] text-gray-400 uppercase">İl</div><div className="text-navy-3 font-medium">{seciliMagaza.il_adi ?? "—"}</div></div>
            <div><div className="text-[9px] text-gray-400 uppercase">Bölge</div><div className="text-navy-3 font-medium">{seciliMagaza.bolge_adi || "—"}</div></div>
            <div><div className="text-[9px] text-gray-400 uppercase">Net m²</div><div className="text-navy-3 font-medium">{seciliMagaza.net_m2 ?? "—"}</div></div>
            <div><div className="text-[9px] text-gray-400 uppercase">Mağaza Müdürü</div><div className="text-navy-3 font-medium">{seciliMagaza.magaza_muduru ?? "—"}</div></div>
          </div>
        )}

        {(enSonAyOzeti || turnoverOzet) && (
          <div className="mb-1">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-[11px] text-gray-400">
                {kpiDonemManuel !== null ? "Seçili dönem" : seciliMagaza ? "Bu mağazanın" : "Tüm mağazaların"} en güncel ayı{enSonAyOzeti && ` — ${enSonAyOzeti.etiket}`}
                {!seciliMagaza && enSonAyOzeti && ` (${enSonAyOzeti.magazaSayisi} mağaza)`}
              </div>
              <select
                value={kpiDonemManuel ?? ""}
                onChange={(e) => setKpiDonemManuel(e.target.value === "" ? null : Number(e.target.value))}
                className="border border-gray-300 rounded-md px-2 py-1 text-[10px] bg-white shrink-0"
              >
                <option value="">Otomatik (en güncel)</option>
                {kpiDonemSecenekleri.map((d) => (
                  <option key={d} value={d}>{AY_KISA[d % 100]} {Math.floor(d / 100)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-3.5">
              {enSonAyOzeti && enSonAyOzeti.degerler.length > 0 && (
                <div>
                  <KpiGrupBasligi>Satış Performansı</KpiGrupBasligi>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {enSonAyOzeti.degerler.map((d) => (
                      <KpiKart
                        key={d.key}
                        label={d.label}
                        kendi={d.kendi}
                        ortalama={d.ortalama}
                        format={d.format}
                        seciliVar={!!seciliMagaza}
                      />
                    ))}
                  </div>
                </div>
              )}

              {turnoverOzet && (
                <div>
                  <KpiGrupBasligi>Personel Devir Oranı</KpiGrupBasligi>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <KpiKart label="İstifa" kendi={turnoverOzet.istifa.kendi} ortalama={turnoverOzet.istifa.ortalama} format={(v) => `%${v.toFixed(1)}`} seciliVar={!!seciliMagaza} tersYon />
                    <KpiKart label="Fesih" kendi={turnoverOzet.fesih.kendi} ortalama={turnoverOzet.fesih.ortalama} format={(v) => `%${v.toFixed(1)}`} seciliVar={!!seciliMagaza} tersYon />
                    <KpiKart label="Toplam" kendi={turnoverOzet.toplam.kendi} ortalama={turnoverOzet.toplam.ortalama} format={(v) => `%${v.toFixed(1)}`} seciliVar={!!seciliMagaza} tersYon />
                  </div>
                </div>
              )}

              <div>
                <KpiGrupBasligi>Kadro / Norm</KpiGrupBasligi>
                <NormKpiKutusu normKpiOzet={normKpiOzet} seciliVar={!!seciliMagaza} />
              </div>

              {calisanKpiOzet && (
                <div>
                  <KpiGrupBasligi>Çalışan</KpiGrupBasligi>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <KpiKart label="Çalışan Sayısı" kendi={calisanKpiOzet.calisanSayisi.kendi} ortalama={calisanKpiOzet.calisanSayisi.ortalama} format={(v) => v.toFixed(0)} seciliVar={!!seciliMagaza} />
                    <KpiKart label="Satış Yapan" kendi={calisanKpiOzet.satisYapan.kendi} ortalama={calisanKpiOzet.satisYapan.ortalama} format={(v) => v.toFixed(0)} seciliVar={!!seciliMagaza} />
                    <KpiKart label="Satış Yapan Oranı" kendi={calisanKpiOzet.oran.kendi} ortalama={calisanKpiOzet.oran.ortalama} format={(v) => `%${v.toFixed(1)}`} seciliVar={!!seciliMagaza} />
                  </div>
                </div>
              )}
            </div>

            {seciliMagaza && calisanGecmisiYukleniyor && (
              <div className="text-xs text-gray-400 py-4 text-center">Çalışan geçmişi yükleniyor...</div>
            )}
            {seciliMagaza && !calisanGecmisiYukleniyor && calisanListesi.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold text-navy-3">Aktif Çalışanlar</div>
                  <select
                    value={calisanListesiDonem ?? ""}
                    onChange={(e) => setCalisanListesiDonem(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-2 py-1 text-[11px] bg-white"
                  >
                    {magazaDonemSecenekleri.map((d) => (
                      <option key={d} value={d}>{AY_KISA[d % 100]} {Math.floor(d / 100)}</option>
                    ))}
                  </select>
                </div>
                <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-md">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase sticky top-0">
                        <th className="text-left px-2 py-1.5">Ad Soyad</th>
                        <th className="text-left px-2 py-1.5">Ünvan</th>
                        <th className="text-right px-2 py-1.5">HGO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calisanListesi.map((c, i) => {
                        const renk = c.hgo !== null ? hgoRenk(c.hgo) : null;
                        return (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="px-2 py-1.5 text-navy-3 font-medium">
                              <button onClick={() => setDetayPersonel({ id: c.personel_id, adSoyad: c.ad_soyad, unvan: c.unvan ?? "" })} className="underline decoration-dotted hover:text-navy">
                                {c.ad_soyad}
                              </button>
                            </td>
                            <td className="px-2 py-1.5 text-gray-500">{c.unvan ?? "—"}</td>
                            <td className={`px-2 py-1.5 text-right font-mono font-semibold ${renk ? renk.metin : "text-gray-400"}`}>
                              {c.hgo !== null ? `%${c.hgo.toFixed(1)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    <ZamanGrafigi performansHam={performansHam} seciliMagaza={seciliMagaza} seciliMagazaId={seciliMagazaId} varsayilanDegisken="hgo" magazalar={magazalar} />
    <ZamanGrafigi performansHam={performansHam} seciliMagaza={seciliMagaza} seciliMagazaId={seciliMagazaId} varsayilanDegisken="adet_hgo" magazalar={magazalar} />
    {detayPersonel && (
      <PersonelDetayModal
        personelId={detayPersonel.id}
        adSoyad={detayPersonel.adSoyad}
        guncelUnvan={detayPersonel.unvan}
        magazaAdi={seciliMagaza?.magaza_adi ?? ""}
        onClose={() => setDetayPersonel(null)}
      />
    )}
    </>
  );
}
