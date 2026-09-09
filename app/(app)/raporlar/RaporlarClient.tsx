"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const TALEP_TURU_ETIKET: Record<string, string> = { ISE_ALIM: "İşe Alım", ISTEN_CIKARMA: "İşten Çıkarma", ROTASYON: "Rotasyon", NORM_DEGISIKLIK: "Norm Değişikliği" };
const DURUM_ETIKET: Record<string, string> = { BEKLEMEDE: "Beklemede", KABUL_EDILDI: "Kabul Edildi", DURAKLADI: "Duraklamış", KAPANDI_RED: "Kapandı (Red)" };
const DURUM_RENK: Record<string, string> = { BEKLEMEDE: "bg-gray-100 text-gray-600", KABUL_EDILDI: "bg-success-bg text-success", DURAKLADI: "bg-accent/15 text-accent", KAPANDI_RED: "bg-danger-bg text-danger" };
const SERI_RENKLERI = ["#0F1B4D", "#3E7CB1", "#C08A2E", "#B0402E", "#2F6F4E", "#6B5B95", "#8C564B", "#4C9A9A"];

type Magaza = { id: string; magaza_adi: string; magaza_kodu: string; bolge_id: string; norm: number; dolu: number; hgo: number | null };
type Bolge = { id: string; ad: string; bmler: { id: string; ad_soyad: string }[]; magazalar: Magaza[] };
type TalepSure = {
  id: string; talep_no: string; talep_turu: string; durum: string;
  magaza_id: string | null; magaza_adi: string; bolge_id: string | null; bolge_adi: string;
  bm_adi: string; ik_adi: string; pozisyon_tipi: string | null; sure_gun: number; kapanmis_mi: boolean; created_at: string;
};
type MagazaRapor = { id: string; magaza_adi: string; magaza_kodu: string; bolge_id: string; bolge_adi: string; bm_adi: string; ik_adi: string; norm: number; dolu: number; hgo: number | null; talep_sayisi: number };
type BolgeRapor = { id: string; ad: string; bm_adi: string; ik_adi: string; magaza_sayisi: number; norm: number; dolu: number; hgo: number | null; talep_sayisi: number };
type IkPerformans = { id: string; ad_soyad: string; toplamIs: number; bekleyenIs: number; toplamAday: number; aylikAdaySayisi: Record<string, number> };

function DolulukRozeti({ dolu, norm }: { dolu: number; norm: number }) {
  const eksik = dolu < norm;
  return <span className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded ${eksik ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>{dolu} / {norm}</span>;
}
function HgoRozeti({ hgo }: { hgo: number | null }) {
  if (hgo == null) return <span className="text-xs text-gray-300">—</span>;
  return <span className={`font-mono text-xs font-semibold ${hgo < 80 ? "text-danger" : hgo > 100 ? "text-success" : "text-navy-3"}`}>%{hgo.toFixed(1)}</span>;
}

function MagazaSatiri({ m }: { m: Magaza }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-50 text-xs">
      <div className="text-navy-3">{m.magaza_kodu} — {m.magaza_adi}</div>
      <div className="flex items-center gap-3"><DolulukRozeti dolu={m.dolu} norm={m.norm} /><HgoRozeti hgo={m.hgo} /></div>
    </div>
  );
}

function BolgeBloku({ bolge, acikBaslangic }: { bolge: Bolge; acikBaslangic?: boolean }) {
  const [acik, setAcik] = useState(!!acikBaslangic);
  const toplamNorm = bolge.magazalar.reduce((s, m) => s + m.norm, 0);
  const toplamDolu = bolge.magazalar.reduce((s, m) => s + m.dolu, 0);
  const hgoDegerleri = bolge.magazalar.filter((m) => m.hgo != null).map((m) => m.hgo as number);
  const ortalamaHgo = hgoDegerleri.length > 0 ? hgoDegerleri.reduce((s, v) => s + v, 0) / hgoDegerleri.length : null;
  return (
    <div className="border border-gray-100 rounded-md overflow-hidden">
      <button onClick={() => setAcik(!acik)} className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{acik ? "▾" : "▸"}</span>
          <span className="text-xs font-semibold text-navy-3">{bolge.ad}</span>
          <span className="text-[10px] text-gray-400">{bolge.bmler.length > 0 ? `BM: ${bolge.bmler.map((b) => b.ad_soyad).join(", ")}` : "BM atanmamış"}</span>
        </div>
        <div className="flex items-center gap-3"><DolulukRozeti dolu={toplamDolu} norm={toplamNorm} /><HgoRozeti hgo={ortalamaHgo} /></div>
      </button>
      {acik && <div>{bolge.magazalar.map((m) => <MagazaSatiri key={m.id} m={m} />)}</div>}
    </div>
  );
}

function IkBloku({ ik }: { ik: { id: string; ad_soyad: string; bolgeler: Bolge[] } }) {
  const [acik, setAcik] = useState(false);
  const tumMagazalar = ik.bolgeler.flatMap((b) => b.magazalar);
  const toplamNorm = tumMagazalar.reduce((s, m) => s + m.norm, 0);
  const toplamDolu = tumMagazalar.reduce((s, m) => s + m.dolu, 0);
  const hgoDegerleri = tumMagazalar.filter((m) => m.hgo != null).map((m) => m.hgo as number);
  const ortalamaHgo = hgoDegerleri.length > 0 ? hgoDegerleri.reduce((s, v) => s + v, 0) / hgoDegerleri.length : null;
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <button onClick={() => setAcik(!acik)} className="w-full flex items-center justify-between px-3 py-2.5 bg-navy/5 hover:bg-navy/10 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">{acik ? "▾" : "▸"}</span>
          <span className="text-sm font-semibold text-navy-3">{ik.ad_soyad}</span>
          <span className="text-[10px] text-gray-400">({ik.bolgeler.length} bölge, {tumMagazalar.length} mağaza)</span>
        </div>
        <div className="flex items-center gap-3"><DolulukRozeti dolu={toplamDolu} norm={toplamNorm} /><HgoRozeti hgo={ortalamaHgo} /></div>
      </button>
      {acik && <div className="p-2 space-y-1.5 bg-white">{ik.bolgeler.map((b) => <BolgeBloku key={b.id} bolge={b} />)}</div>}
    </div>
  );
}

function SiralanabilirBaslik({ label, alan, aktifAlan, yon, onTikla }: { label: string; alan: string; aktifAlan: string; yon: "asc" | "desc"; onTikla: (alan: string) => void }) {
  const aktif = alan === aktifAlan;
  return (
    <th onClick={() => onTikla(alan)} className="text-left px-2 py-1.5 cursor-pointer select-none hover:text-navy-3">
      {label} {aktif && (yon === "asc" ? "▲" : "▼")}
    </th>
  );
}

export default function RaporlarClient({ hiyerarsi, talepSureVeri, bolgeler, ikPerformans, magazaRaporVeri, bolgeRaporVeri, benimRolum }: {
  hiyerarsi: any; talepSureVeri: TalepSure[]; bolgeler: { id: string; ad: string }[];
  ikPerformans: IkPerformans[] | null; magazaRaporVeri: MagazaRapor[]; bolgeRaporVeri: BolgeRapor[]; benimRolum: string;
}) {
  const [sekme, setSekme] = useState<"genel" | "ik_bm" | "magaza">("genel");

  // ---- Ortak filtreler (Genel sekmesindeki talep süreç süresi için) ----
  const [turFiltre, setTurFiltre] = useState("");
  const [durumFiltre, setDurumFiltre] = useState("");
  const [bolgeFiltre, setBolgeFiltre] = useState("");
  const [gunAraligi, setGunAraligi] = useState<"30" | "90" | "365" | "TUMU">("90");

  const filtrelenmisTalepler = useMemo(() => {
    const simdi = Date.now();
    return talepSureVeri.filter((t) => {
      if (turFiltre && t.talep_turu !== turFiltre) return false;
      if (durumFiltre && t.durum !== durumFiltre) return false;
      if (bolgeFiltre && t.bolge_id !== bolgeFiltre) return false;
      if (gunAraligi !== "TUMU") {
        const gunFarki = (simdi - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (gunFarki > Number(gunAraligi)) return false;
      }
      return true;
    });
  }, [talepSureVeri, turFiltre, durumFiltre, bolgeFiltre, gunAraligi]);

  const kapanmisTalepler = filtrelenmisTalepler.filter((t) => t.kapanmis_mi);
  const turBazliOrtalama = useMemo(() => {
    const gruplar: Record<string, number[]> = {};
    kapanmisTalepler.forEach((t) => { gruplar[t.talep_turu] = [...(gruplar[t.talep_turu] ?? []), t.sure_gun]; });
    return Object.entries(gruplar).map(([tur, sureler]) => ({ tur, etiket: TALEP_TURU_ETIKET[tur] ?? tur, ortalama: sureler.reduce((s, v) => s + v, 0) / sureler.length, adet: sureler.length }));
  }, [kapanmisTalepler]);
  const enYavas = useMemo(() => kapanmisTalepler.slice().sort((a, b) => b.sure_gun - a.sure_gun).slice(0, 5), [kapanmisTalepler]);
  const enHizli = useMemo(() => kapanmisTalepler.slice().sort((a, b) => a.sure_gun - b.sure_gun).slice(0, 5), [kapanmisTalepler]);

  // ---- İK karşılaştırma verisi (aylık, çok seri) ----
  const ikAylikGrafikVerisi = useMemo(() => {
    if (!ikPerformans) return [];
    const tumAylar = new Set<string>();
    ikPerformans.forEach((ik) => Object.keys(ik.aylikAdaySayisi).forEach((ay) => tumAylar.add(ay)));
    return Array.from(tumAylar).sort().map((ay) => {
      const satir: any = { ay };
      ikPerformans.forEach((ik) => { satir[ik.ad_soyad] = ik.aylikAdaySayisi[ay] ?? 0; });
      return satir;
    });
  }, [ikPerformans]);

  const ikKarsilastirmaVerisi = useMemo(
    () => (ikPerformans ?? []).map((ik) => ({ ad_soyad: ik.ad_soyad, "Toplam İş": ik.toplamIs, "Bekleyen İş": ik.bekleyenIs, "Toplam Aday": ik.toplamAday })),
    [ikPerformans]
  );

  // ---- Bölge (İK Sorumlusu - BM) sıralanabilir tablo ----
  const [bolgeSiralaAlan, setBolgeSiralaAlan] = useState("talep_sayisi");
  const [bolgeSiralaYon, setBolgeSiralaYon] = useState<"asc" | "desc">("desc");
  const bolgeSirali = useMemo(() => {
    const kopya = bolgeRaporVeri.slice();
    kopya.sort((a: any, b: any) => {
      const av = a[bolgeSiralaAlan] ?? -Infinity, bv = b[bolgeSiralaAlan] ?? -Infinity;
      if (typeof av === "string") return bolgeSiralaYon === "asc" ? av.localeCompare(bv, "tr") : bv.localeCompare(av, "tr");
      return bolgeSiralaYon === "asc" ? av - bv : bv - av;
    });
    return kopya;
  }, [bolgeRaporVeri, bolgeSiralaAlan, bolgeSiralaYon]);
  function bolgeSiralamayiDegistir(alan: string) {
    if (alan === bolgeSiralaAlan) setBolgeSiralaYon(bolgeSiralaYon === "asc" ? "desc" : "asc");
    else { setBolgeSiralaAlan(alan); setBolgeSiralaYon("desc"); }
  }

  // ---- Mağaza sıralanabilir tablo ----
  const [magazaSiralaAlan, setMagazaSiralaAlan] = useState("talep_sayisi");
  const [magazaSiralaYon, setMagazaSiralaYon] = useState<"asc" | "desc">("desc");
  const magazaSirali = useMemo(() => {
    const kopya = magazaRaporVeri.slice();
    kopya.sort((a: any, b: any) => {
      const av = a[magazaSiralaAlan] ?? -Infinity, bv = b[magazaSiralaAlan] ?? -Infinity;
      if (typeof av === "string") return magazaSiralaYon === "asc" ? av.localeCompare(bv, "tr") : bv.localeCompare(av, "tr");
      return magazaSiralaYon === "asc" ? av - bv : bv - av;
    });
    return kopya;
  }, [magazaRaporVeri, magazaSiralaAlan, magazaSiralaYon]);
  function magazaSiralamayiDegistir(alan: string) {
    if (alan === magazaSiralaAlan) setMagazaSiralaYon(magazaSiralaYon === "asc" ? "desc" : "asc");
    else { setMagazaSiralaAlan(alan); setMagazaSiralaYon("desc"); }
  }
  const enYuksekTalepliMagazalar = useMemo(() => magazaRaporVeri.slice().sort((a, b) => b.talep_sayisi - a.talep_sayisi).slice(0, 10), [magazaRaporVeri]);

  // ---- Ünvan bazlı analiz (İşe Alım talepleri üzerinden) ----
  const iseAlimTalepleri = useMemo(() => talepSureVeri.filter((t) => t.talep_turu === "ISE_ALIM" && t.pozisyon_tipi), [talepSureVeri]);

  const unvanGenelDagilim = useMemo(() => {
    const sayac: Record<string, number> = {};
    iseAlimTalepleri.forEach((t) => { sayac[t.pozisyon_tipi!] = (sayac[t.pozisyon_tipi!] ?? 0) + 1; });
    return Object.entries(sayac).map(([unvan, adet]) => ({ unvan, adet })).sort((a, b) => b.adet - a.adet).slice(0, 12);
  }, [iseAlimTalepleri]);

  // Her İK için en çok aldığı ünvan (kendi bölgelerindeki İşe Alım talepleri üzerinden).
  const ikUnvanEnCok = useMemo(() => {
    const ikBazinda: Record<string, Record<string, number>> = {};
    iseAlimTalepleri.forEach((t) => {
      if (t.ik_adi === "—") return;
      if (!ikBazinda[t.ik_adi]) ikBazinda[t.ik_adi] = {};
      ikBazinda[t.ik_adi][t.pozisyon_tipi!] = (ikBazinda[t.ik_adi][t.pozisyon_tipi!] ?? 0) + 1;
    });
    return Object.entries(ikBazinda).map(([ik_adi, unvanlar]) => {
      const siraliUnvanlar = Object.entries(unvanlar).sort((a, b) => b[1] - a[1]);
      return { ik_adi, enCokUnvan: siraliUnvanlar[0]?.[0] ?? "—", adet: siraliUnvanlar[0]?.[1] ?? 0, toplamIseAlim: Object.values(unvanlar).reduce((s, v) => s + v, 0) };
    }).sort((a, b) => b.toplamIseAlim - a.toplamIseAlim);
  }, [iseAlimTalepleri]);

  // Her bölge için en çok ihtiyaç duyulan ünvan.
  const bolgeUnvanEnCok = useMemo(() => {
    const bolgeBazinda: Record<string, Record<string, number>> = {};
    iseAlimTalepleri.forEach((t) => {
      if (t.bolge_adi === "—") return;
      if (!bolgeBazinda[t.bolge_adi]) bolgeBazinda[t.bolge_adi] = {};
      bolgeBazinda[t.bolge_adi][t.pozisyon_tipi!] = (bolgeBazinda[t.bolge_adi][t.pozisyon_tipi!] ?? 0) + 1;
    });
    return Object.entries(bolgeBazinda).map(([bolge_adi, unvanlar]) => {
      const siraliUnvanlar = Object.entries(unvanlar).sort((a, b) => b[1] - a[1]);
      return { bolge_adi, enCokUnvan: siraliUnvanlar[0]?.[0] ?? "—", adet: siraliUnvanlar[0]?.[1] ?? 0, toplamIseAlim: Object.values(unvanlar).reduce((s, v) => s + v, 0) };
    }).sort((a, b) => b.toplamIseAlim - a.toplamIseAlim);
  }, [iseAlimTalepleri]);

  // ---- Devir (turnover) — onaylanmış İşten Çıkarma talepleri, mağaza bazlı ----
  const devirEnCokMagaza = useMemo(() => {
    const sayac: Record<string, number> = {};
    talepSureVeri.forEach((t) => {
      if (t.talep_turu === "ISTEN_CIKARMA" && t.durum === "KABUL_EDILDI") {
        sayac[t.magaza_adi] = (sayac[t.magaza_adi] ?? 0) + 1;
      }
    });
    return Object.entries(sayac).map(([magaza_adi, adet]) => ({ magaza_adi, adet })).sort((a, b) => b.adet - a.adet).slice(0, 10);
  }, [talepSureVeri]);

  const devirEnCokBolge = useMemo(() => {
    const sayac: Record<string, number> = {};
    talepSureVeri.forEach((t) => {
      if (t.talep_turu === "ISTEN_CIKARMA" && t.durum === "KABUL_EDILDI") {
        sayac[t.bolge_adi] = (sayac[t.bolge_adi] ?? 0) + 1;
      }
    });
    return Object.entries(sayac).map(([bolge_adi, adet]) => ({ bolge_adi, adet })).sort((a, b) => b.adet - a.adet);
  }, [talepSureVeri]);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-lg font-semibold text-navy-3">Raporlar</div>
        <div className="text-xs text-gray-400 mt-0.5">Hiyerarşik performans görünümü, İK karşılaştırması ve talep süreç süreleri</div>
      </div>

      <div className="flex rounded-md border border-gray-200 overflow-hidden w-fit">
        {([["genel", "Genel"], ["ik_bm", "İK Sorumlusu - BM"], ["magaza", "Mağaza"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSekme(key)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${sekme === key ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ============ GENEL SEKMESİ ============ */}
      {sekme === "genel" && (
        <>
          <div className="bg-white border border-gray-200 rounded-card p-4">
            <div className="text-sm font-semibold text-navy-3 mb-3">Performans Görünümü</div>
            <div className="space-y-2">
              {hiyerarsi.tip === "YONETIM" && hiyerarsi.ikler.map((ik: any) => <IkBloku key={ik.id} ik={ik} />)}
              {hiyerarsi.tip === "IK" && hiyerarsi.bolgeler.map((b: Bolge) => <BolgeBloku key={b.id} bolge={b} acikBaslangic />)}
              {hiyerarsi.tip === "BM" && (
                <div className="border border-gray-100 rounded-md overflow-hidden">
                  {hiyerarsi.magazalar.map((m: Magaza) => <MagazaSatiri key={m.id} m={m} />)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-card p-4">
            <div className="text-sm font-semibold text-navy-3 mb-3">Ünvan ve Devir Analizi</div>

            <div className="mb-4">
              <div className="text-[11px] font-semibold text-navy-3 mb-1">En Çok Talep Edilen Ünvanlar (İşe Alım)</div>
              {unvanGenelDagilim.length === 0 ? (
                <div className="text-xs text-gray-400 py-4 text-center">Veri yok.</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(140, unvanGenelDagilim.length * 26)}>
                  <BarChart data={unvanGenelDagilim} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="unvan" tick={{ fontSize: 9 }} width={150} />
                    <Tooltip />
                    <Bar dataKey="adet" name="Talep Sayısı" fill="#3E7CB1" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[11px] font-semibold text-navy-3 mb-1.5">İK Bazında En Çok Alınan Ünvan</div>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {ikUnvanEnCok.map((r) => (
                    <div key={r.ik_adi} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                      <div>
                        <div className="text-navy-3 font-medium">{r.ik_adi}</div>
                        <div className="text-[10px] text-gray-400">{r.toplamIseAlim} işe alım toplam</div>
                      </div>
                      <div className="text-right">
                        <div className="text-navy-3">{r.enCokUnvan}</div>
                        <div className="text-[10px] text-info font-mono">{r.adet} kez</div>
                      </div>
                    </div>
                  ))}
                  {ikUnvanEnCok.length === 0 && <div className="text-[11px] text-gray-400">Veri yok.</div>}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-navy-3 mb-1.5">Bölge Bazında En Çok İhtiyaç Duyulan Ünvan</div>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {bolgeUnvanEnCok.map((r) => (
                    <div key={r.bolge_adi} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                      <div>
                        <div className="text-navy-3 font-medium">{r.bolge_adi}</div>
                        <div className="text-[10px] text-gray-400">{r.toplamIseAlim} işe alım toplam</div>
                      </div>
                      <div className="text-right">
                        <div className="text-navy-3">{r.enCokUnvan}</div>
                        <div className="text-[10px] text-info font-mono">{r.adet} kez</div>
                      </div>
                    </div>
                  ))}
                  {bolgeUnvanEnCok.length === 0 && <div className="text-[11px] text-gray-400">Veri yok.</div>}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <div className="text-[11px] font-semibold text-danger mb-1.5">Devir (Onaylanmış İşten Çıkarma) En Çok Nerede</div>
              {devirEnCokMagaza.length === 0 ? (
                <div className="text-xs text-gray-400 py-4 text-center">Kayıtlı devir yok.</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(140, devirEnCokMagaza.length * 26)}>
                  <BarChart data={devirEnCokMagaza} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="magaza_adi" tick={{ fontSize: 9 }} width={150} />
                    <Tooltip />
                    <Bar dataKey="adet" name="Devir Sayısı" fill="#B0402E" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {devirEnCokBolge.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {devirEnCokBolge.map((b) => (
                    <span key={b.bolge_adi} className="text-[10px] bg-danger-bg text-danger px-2 py-0.5 rounded-full">{b.bolge_adi}: {b.adet}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-card p-3">
            <select value={turFiltre} onChange={(e) => setTurFiltre(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
              <option value="">Tüm Talep Türleri</option>
              {Object.entries(TALEP_TURU_ETIKET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={durumFiltre} onChange={(e) => setDurumFiltre(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
              <option value="">Tüm Durumlar</option>
              {Object.entries(DURUM_ETIKET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {bolgeler.length > 1 && (
              <select value={bolgeFiltre} onChange={(e) => setBolgeFiltre(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
                <option value="">Tüm Bölgeler</option>
                {bolgeler.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
              </select>
            )}
            <div className="flex rounded-md border border-gray-200 overflow-hidden ml-auto">
              {(["30", "90", "365", "TUMU"] as const).map((g) => (
                <button key={g} onClick={() => setGunAraligi(g)} className={`px-2.5 py-1.5 text-[11px] font-medium ${gunAraligi === g ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {g === "TUMU" ? "Tümü" : `Son ${g} gün`}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-card p-4">
            <div className="text-sm font-semibold text-navy-3 mb-3">
              Talep Süreç Süresi <span className="text-[11px] text-gray-400 font-normal">({kapanmisTalepler.length} kapanmış talep)</span>
            </div>
            {turBazliOrtalama.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {turBazliOrtalama.map((t) => (
                  <div key={t.tur} className="bg-gray-50 rounded-md px-3 py-2">
                    <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{t.etiket}</div>
                    <div className="text-sm font-mono font-semibold text-navy-3">{t.ortalama.toFixed(1)} gün</div>
                    <div className="text-[9px] text-gray-400">{t.adet} talep</div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[11px] font-semibold text-danger mb-1.5">En Yavaş 5 Talep</div>
                <div className="space-y-1">
                  {enYavas.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs bg-danger-bg/40 rounded px-2 py-1">
                      <span className="font-mono text-navy-3">{t.talep_no}</span>
                      <span className="text-gray-500">{t.magaza_adi}</span>
                      <span className="font-mono font-semibold text-danger">{t.sure_gun} gün</span>
                    </div>
                  ))}
                  {enYavas.length === 0 && <div className="text-[11px] text-gray-400">Veri yok.</div>}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-success mb-1.5">En Hızlı 5 Talep</div>
                <div className="space-y-1">
                  {enHizli.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs bg-success-bg/40 rounded px-2 py-1">
                      <span className="font-mono text-navy-3">{t.talep_no}</span>
                      <span className="text-gray-500">{t.magaza_adi}</span>
                      <span className="font-mono font-semibold text-success">{t.sure_gun} gün</span>
                    </div>
                  ))}
                  {enHizli.length === 0 && <div className="text-[11px] text-gray-400">Veri yok.</div>}
                </div>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto border border-gray-100 rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase sticky top-0">
                    <th className="text-left px-2 py-1.5">Talep No</th>
                    <th className="text-left px-2 py-1.5">Tür</th>
                    <th className="text-left px-2 py-1.5">Mağaza</th>
                    <th className="text-left px-2 py-1.5">Bölge</th>
                    <th className="text-left px-2 py-1.5">BM</th>
                    <th className="text-left px-2 py-1.5">İK</th>
                    <th className="text-left px-2 py-1.5">Durum</th>
                    <th className="text-right px-2 py-1.5">Süre</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrelenmisTalepler.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((t) => (
                    <tr key={t.id} className="border-t border-gray-50">
                      <td className="px-2 py-1.5 font-mono text-navy-3">{t.talep_no}</td>
                      <td className="px-2 py-1.5 text-gray-600">{TALEP_TURU_ETIKET[t.talep_turu] ?? t.talep_turu}</td>
                      <td className="px-2 py-1.5 text-gray-600">{t.magaza_adi}</td>
                      <td className="px-2 py-1.5 text-gray-500">{t.bolge_adi}</td>
                      <td className="px-2 py-1.5 text-gray-500">{t.bm_adi}</td>
                      <td className="px-2 py-1.5 text-gray-500">{t.ik_adi}</td>
                      <td className="px-2 py-1.5"><span className={`text-[10px] px-1.5 py-0.5 rounded ${DURUM_RENK[t.durum] ?? "bg-gray-100 text-gray-600"}`}>{DURUM_ETIKET[t.durum] ?? t.durum}</span></td>
                      <td className="px-2 py-1.5 text-right font-mono text-navy-3">{t.sure_gun} gün{!t.kapanmis_mi && <span className="text-gray-400"> (devam ediyor)</span>}</td>
                    </tr>
                  ))}
                  {filtrelenmisTalepler.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-gray-400">Bu filtreye uyan talep yok.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ============ İK SORUMLUSU - BM SEKMESİ ============ */}
      {sekme === "ik_bm" && (
        <>
          {ikPerformans && ikPerformans.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-card p-4">
              <div className="text-sm font-semibold text-navy-3 mb-3">İK Personeli Performans Karşılaştırması</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                {ikPerformans.map((ik) => (
                  <div key={ik.id} className="bg-gray-50 rounded-md p-3">
                    <div className="text-xs font-semibold text-navy-3 mb-1.5">{ik.ad_soyad}</div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div><div className="text-[9px] text-gray-400 uppercase">Toplam İş</div><div className="font-mono font-semibold text-navy-3">{ik.toplamIs}</div></div>
                      <div><div className="text-[9px] text-gray-400 uppercase">Bekleyen</div><div className={`font-mono font-semibold ${ik.bekleyenIs > 0 ? "text-danger" : "text-navy-3"}`}>{ik.bekleyenIs}</div></div>
                      <div><div className="text-[9px] text-gray-400 uppercase">Toplam Aday</div><div className="font-mono font-semibold text-navy-3">{ik.toplamAday}</div></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-4">
                <div className="text-[11px] font-semibold text-navy-3 mb-1">İş Yükü Karşılaştırması</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ikKarsilastirmaVerisi} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="ad_soyad" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Toplam İş" fill="#0F1B4D" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Bekleyen İş" fill="#B0402E" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Toplam Aday" fill="#3E7CB1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {ikAylikGrafikVerisi.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-navy-3 mb-1">Aylık Yönlendirilen Aday Sayısı — İK Karşılaştırması</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={ikAylikGrafikVerisi} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="ay" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {ikPerformans.map((ik, i) => (
                        <Line key={ik.id} type="monotone" dataKey={ik.ad_soyad} stroke={SERI_RENKLERI[i % SERI_RENKLERI.length]} strokeWidth={2} dot={{ r: 2.5 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-card p-4">
            <div className="text-sm font-semibold text-navy-3 mb-3">Bölge Karşılaştırması (İK / BM bazlı)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase border-b-2 border-navy">
                    <SiralanabilirBaslik label="Bölge" alan="ad" aktifAlan={bolgeSiralaAlan} yon={bolgeSiralaYon} onTikla={bolgeSiralamayiDegistir} />
                    <SiralanabilirBaslik label="İK" alan="ik_adi" aktifAlan={bolgeSiralaAlan} yon={bolgeSiralaYon} onTikla={bolgeSiralamayiDegistir} />
                    <SiralanabilirBaslik label="BM" alan="bm_adi" aktifAlan={bolgeSiralaAlan} yon={bolgeSiralaYon} onTikla={bolgeSiralamayiDegistir} />
                    <SiralanabilirBaslik label="Mağaza" alan="magaza_sayisi" aktifAlan={bolgeSiralaAlan} yon={bolgeSiralaYon} onTikla={bolgeSiralamayiDegistir} />
                    <th className="text-right px-2 py-1.5">Doluluk</th>
                    <th className="text-right px-2 py-1.5">Ort. HGO</th>
                    <SiralanabilirBaslik label="Talep" alan="talep_sayisi" aktifAlan={bolgeSiralaAlan} yon={bolgeSiralaYon} onTikla={bolgeSiralamayiDegistir} />
                  </tr>
                </thead>
                <tbody>
                  {bolgeSirali.map((b) => (
                    <tr key={b.id} className="border-t border-gray-50">
                      <td className="px-2 py-1.5 font-medium text-navy-3">{b.ad}</td>
                      <td className="px-2 py-1.5 text-gray-600">{b.ik_adi}</td>
                      <td className="px-2 py-1.5 text-gray-600">{b.bm_adi}</td>
                      <td className="px-2 py-1.5 text-gray-600">{b.magaza_sayisi}</td>
                      <td className="px-2 py-1.5 text-right"><DolulukRozeti dolu={b.dolu} norm={b.norm} /></td>
                      <td className="px-2 py-1.5 text-right"><HgoRozeti hgo={b.hgo} /></td>
                      <td className="px-2 py-1.5 text-right font-mono text-navy-3">{b.talep_sayisi}</td>
                    </tr>
                  ))}
                  {bolgeSirali.length === 0 && <tr><td colSpan={7} className="px-2 py-6 text-center text-gray-400">Görüntülenecek veri yok.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ============ MAĞAZA SEKMESİ ============ */}
      {sekme === "magaza" && (
        <>
          <div className="bg-white border border-gray-200 rounded-card p-4">
            <div className="text-sm font-semibold text-navy-3 mb-3">En Yüksek Talepli Mağazalar</div>
            <ResponsiveContainer width="100%" height={Math.max(180, enYuksekTalepliMagazalar.length * 32)}>
              <BarChart data={enYuksekTalepliMagazalar} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                <YAxis type="category" dataKey="magaza_adi" tick={{ fontSize: 9 }} width={160} />
                <Tooltip />
                <Bar dataKey="talep_sayisi" name="Talep Sayısı" fill="#0F1B4D" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-200 rounded-card p-4">
            <div className="text-sm font-semibold text-navy-3 mb-3">Tüm Mağazalar — Karşılaştırma</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase border-b-2 border-navy">
                    <SiralanabilirBaslik label="Mağaza" alan="magaza_adi" aktifAlan={magazaSiralaAlan} yon={magazaSiralaYon} onTikla={magazaSiralamayiDegistir} />
                    <SiralanabilirBaslik label="Bölge" alan="bolge_adi" aktifAlan={magazaSiralaAlan} yon={magazaSiralaYon} onTikla={magazaSiralamayiDegistir} />
                    <SiralanabilirBaslik label="BM" alan="bm_adi" aktifAlan={magazaSiralaAlan} yon={magazaSiralaYon} onTikla={magazaSiralamayiDegistir} />
                    <SiralanabilirBaslik label="İK" alan="ik_adi" aktifAlan={magazaSiralaAlan} yon={magazaSiralaYon} onTikla={magazaSiralamayiDegistir} />
                    <th className="text-right px-2 py-1.5">Doluluk</th>
                    <th className="text-right px-2 py-1.5">HGO</th>
                    <SiralanabilirBaslik label="Talep" alan="talep_sayisi" aktifAlan={magazaSiralaAlan} yon={magazaSiralaYon} onTikla={magazaSiralamayiDegistir} />
                  </tr>
                </thead>
                <tbody>
                  {magazaSirali.map((m) => (
                    <tr key={m.id} className="border-t border-gray-50">
                      <td className="px-2 py-1.5 font-medium text-navy-3">{m.magaza_kodu} — {m.magaza_adi}</td>
                      <td className="px-2 py-1.5 text-gray-600">{m.bolge_adi}</td>
                      <td className="px-2 py-1.5 text-gray-600">{m.bm_adi}</td>
                      <td className="px-2 py-1.5 text-gray-600">{m.ik_adi}</td>
                      <td className="px-2 py-1.5 text-right"><DolulukRozeti dolu={m.dolu} norm={m.norm} /></td>
                      <td className="px-2 py-1.5 text-right"><HgoRozeti hgo={m.hgo} /></td>
                      <td className="px-2 py-1.5 text-right font-mono text-navy-3">{m.talep_sayisi}</td>
                    </tr>
                  ))}
                  {magazaSirali.length === 0 && <tr><td colSpan={7} className="px-2 py-6 text-center text-gray-400">Görüntülenecek veri yok.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
