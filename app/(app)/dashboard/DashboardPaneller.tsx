"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";

type Magaza = {
  id: string; magaza_kodu: string; magaza_adi: string; bolge_id: string | null; bolge_adi: string;
  subetipi: string | null; net_m2: number | null;
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

function hgoRenk(hgo: number) {
  if (hgo < 80) return { bar: "bg-danger", metin: "text-danger" };
  if (hgo <= 100) return { bar: "bg-accent", metin: "text-accent" };
  return { bar: "bg-success", metin: "text-success" };
}

// Mağaza adında genelde marka/kısaltma önekleri sonra il adı gelir (örn. "A.K. İstanbul Carousel").
// Kesin bir "il" alanı DB'de tutulmadığı için en iyi tahminle çıkarım yapıyoruz.
function ilTahminEt(magazaAdi: string): string {
  const kelimeler = magazaAdi.trim().split(/\s+/);
  for (const k of kelimeler) {
    if (/^[A-ZÇĞİÖŞÜ.]+\.$/.test(k) || k.length <= 3) continue;
    return k;
  }
  return kelimeler[0] ?? "";
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

export default function DashboardPaneller({ magazalar, bolgeler, performansHam }: { magazalar: Magaza[]; bolgeler: Bolge[]; performansHam: PerformansSatiri[] }) {
  // ---- Sol panel (Mağazalar) filtreleri ----
  const [solBolgeler, setSolBolgeler] = useState<Set<string>>(new Set());
  const [solArama, setSolArama] = useState("");
  const [normMin, setNormMin] = useState("");
  const [normMax, setNormMax] = useState("");
  const [durumFiltre, setDurumFiltre] = useState<Set<NormDurum>>(new Set());

  // ---- Sağ panel (Performans) filtreleri ----
  const [sagBolgeler, setSagBolgeler] = useState<Set<string>>(new Set());
  const [hgoMin, setHgoMin] = useState("");
  const [hgoMax, setHgoMax] = useState("");
  const [yilFiltre, setYilFiltre] = useState("");
  const [ayFiltre, setAyFiltre] = useState("");

  const [seciliMagazaId, setSeciliMagazaId] = useState<string | null>(null);

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
  const [zamanDegisken, setZamanDegisken] = useState<keyof PerformansSatiri>("hgo");
  const zamanTanim = ZAMAN_DEGISKENLERI.find((d) => d.key === zamanDegisken)!;

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
    });

    return Array.from(ortalamaMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([grupAnahtari, g]) => ({
        etiket: `${AY_KISA[g.ay]} ${String(g.yil).slice(2)}`,
        ortalama: g.sayi > 0 ? g.toplam / g.sayi : null,
        secili: seciliMap.has(grupAnahtari) ? seciliMap.get(grupAnahtari)! : null,
      }));
  }, [performansHam, zamanDegisken, etkinBaslangic, etkinBitis, seciliMagazaId]);

  const enSonAyOzeti = useMemo(() => {
    // Mağaza seçiliyse: o mağazanın kendi en güncel ayı. Seçili değilse: tüm mağazaların ortalaması.
    const kaynakVeri = seciliMagazaId ? performansHam.filter((p) => p.magaza_id === seciliMagazaId) : performansHam;
    if (kaynakVeri.length === 0) return null;

    let enSonYil = 0, enSonAy = 0;
    kaynakVeri.forEach((p) => {
      if (p.yil > enSonYil || (p.yil === enSonYil && p.ay > enSonAy)) { enSonYil = p.yil; enSonAy = p.ay; }
    });
    const buAyVerisi = kaynakVeri.filter((p) => p.yil === enSonYil && p.ay === enSonAy);
    const sonuc: Record<string, { toplam: number; sayi: number }> = {};
    ZAMAN_DEGISKENLERI.forEach((d) => { sonuc[d.key] = { toplam: 0, sayi: 0 }; });
    buAyVerisi.forEach((p) => {
      ZAMAN_DEGISKENLERI.forEach((d) => {
        const deger = p[d.key];
        if (deger === null || deger === undefined) return;
        sonuc[d.key].toplam += deger as number;
        sonuc[d.key].sayi += 1;
      });
    });
    return {
      etiket: `${AY_KISA[enSonAy]} ${enSonYil}`,
      magazaSayisi: buAyVerisi.length,
      degerler: ZAMAN_DEGISKENLERI.map((d) => ({ ...d, ortalama: sonuc[d.key].sayi > 0 ? sonuc[d.key].toplam / sonuc[d.key].sayi : null })),
    };
  }, [performansHam, seciliMagazaId]);

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* SOL PANEL — Mağazalar */}
      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-sm font-semibold text-navy-3 mb-2">Mağazalar — Norm Doluluk</div>
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
        </div>

        {solFiltrelenmis.length === 0 ? (
          <div className="text-xs text-gray-400">Bu filtreye uyan mağaza yok.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1">
            {solFiltrelenmis.map((m) => {
              const durum = normDurumu(m);
              const secili = seciliMagazaId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSeciliMagazaId(secili ? null : m.id)}
                  className={`text-left border border-gray-100 ${DURUM_BORDER[durum]} rounded-md p-2 transition-colors ${
                    secili ? "bg-navy/5 ring-1 ring-navy" : "hover:bg-gray-50"
                  }`}
                  title={`${m.magaza_adi} — ${m.bolge_adi} (${DURUM_ETIKET[durum]})`}
                >
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
                  <div className="text-[9px] text-gray-400 font-mono mt-1.5">{m.toplamDolu}/{m.toplamNorm} (%{m.oran})</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SAĞ PANEL — Performans */}
      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-navy-3">
            {seciliMagaza ? `Performans — ${seciliMagaza.magaza_adi}` : "Mağazalar — Performans (HGO)"}
          </div>
          {seciliMagaza && (
            <button onClick={() => setSeciliMagazaId(null)} className="text-[11px] text-info hover:underline">◀ Tüm Mağazalar</button>
          )}
        </div>

        {enSonAyOzeti && (
          <div className="mb-3 pb-3 border-b border-gray-100">
            <div className="text-[10px] text-gray-400 mb-1.5">
              {seciliMagaza ? "Bu mağazanın" : "Tüm mağazaların"} en güncel ayı — {enSonAyOzeti.etiket}
              {!seciliMagaza && ` (${enSonAyOzeti.magazaSayisi} mağaza)`}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {enSonAyOzeti.degerler.map((d) => (
                <div key={d.key} className="bg-gray-50 rounded-md px-1.5 py-1.5">
                  <div className="text-[8px] text-gray-400 uppercase leading-tight mb-0.5">{d.label}</div>
                  <div className="text-[11px] font-mono font-semibold text-navy-3">{d.ortalama !== null ? d.format(d.ortalama) : "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {seciliMagaza && (
          <div className="grid grid-cols-3 gap-2 mb-3 bg-gray-50 rounded-md p-2.5 text-[11px]">
            <div><div className="text-[9px] text-gray-400 uppercase">İl (tahmini)</div><div className="text-navy-3 font-medium">{ilTahminEt(seciliMagaza.magaza_adi)}</div></div>
            <div><div className="text-[9px] text-gray-400 uppercase">Bölge</div><div className="text-navy-3 font-medium">{seciliMagaza.bolge_adi || "—"}</div></div>
            <div><div className="text-[9px] text-gray-400 uppercase">Net m²</div><div className="text-navy-3 font-medium">{seciliMagaza.net_m2 ?? "—"}</div></div>
          </div>
        )}
      </div>
    </div>

    <div className="bg-white border border-gray-200 rounded-card p-4 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-sm font-semibold text-navy-3">
          Zaman İçinde Performans
          {seciliMagaza && <span className="text-gray-400 font-normal"> — {seciliMagaza.magaza_adi} vs. Tüm Mağaza Ortalaması</span>}
        </div>
        <div className="flex items-center gap-2">
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
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="etiket" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => zamanTanim.format(v)} labelStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="ortalama" stroke="#9ca3af" strokeWidth={2} dot={{ r: 2 }} name="Tüm Mağaza Ortalaması" connectNulls>
              {!seciliMagaza && (
                <LabelList dataKey="ortalama" position="top" style={{ fontSize: 10, fill: "#6b7280" }} formatter={(v: number) => zamanTanim.format(v)} />
              )}
            </Line>
            {seciliMagaza && (
              <Line type="monotone" dataKey="secili" stroke="#00365a" strokeWidth={2.5} dot={{ r: 3 }} name={seciliMagaza.magaza_adi} connectNulls>
                <LabelList dataKey="secili" position="top" style={{ fontSize: 10, fill: "#00365a" }} formatter={(v: number) => zamanTanim.format(v)} />
              </Line>
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="text-[10px] text-gray-400 mt-1">
        {seciliMagaza
          ? "Gri çizgi tüm mağazaların ortalaması, lacivert çizgi seçili mağaza — üstünde/altında olması karşılaştırma sağlar."
          : "Soldaki listeden bir mağaza seçerseniz, o mağazanın çizgisi tüm mağaza ortalamasıyla birlikte gösterilir."}
      </div>
    </div>
    </>
  );
}
