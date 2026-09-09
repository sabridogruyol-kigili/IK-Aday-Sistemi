"use client";

import { useMemo, useState } from "react";

const TALEP_TURU_ETIKET: Record<string, string> = { ISE_ALIM: "İşe Alım", ISTEN_CIKARMA: "İşten Çıkarma", ROTASYON: "Rotasyon", NORM_DEGISIKLIK: "Norm Değişikliği" };
const DURUM_ETIKET: Record<string, string> = { BEKLEMEDE: "Beklemede", KABUL_EDILDI: "Kabul Edildi", DURAKLADI: "Duraklamış", KAPANDI_RED: "Kapandı (Red)" };
const DURUM_RENK: Record<string, string> = { BEKLEMEDE: "bg-gray-100 text-gray-600", KABUL_EDILDI: "bg-success-bg text-success", DURAKLADI: "bg-accent/15 text-accent", KAPANDI_RED: "bg-danger-bg text-danger" };

type Magaza = { id: string; magaza_adi: string; magaza_kodu: string; bolge_id: string; norm: number; dolu: number; hgo: number | null };
type Bolge = { id: string; ad: string; bmler: { id: string; ad_soyad: string }[]; magazalar: Magaza[] };
type TalepSure = { id: string; talep_no: string; talep_turu: string; durum: string; bolge_id: string | null; sure_gun: number; kapanmis_mi: boolean; created_at: string };

function DolulukRozeti({ dolu, norm }: { dolu: number; norm: number }) {
  const eksik = dolu < norm;
  return (
    <span className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded ${eksik ? "bg-danger-bg text-danger" : "bg-success-bg text-success"}`}>
      {dolu} / {norm}
    </span>
  );
}

function HgoRozeti({ hgo }: { hgo: number | null }) {
  if (hgo == null) return <span className="text-xs text-gray-300">—</span>;
  return <span className={`font-mono text-xs font-semibold ${hgo < 80 ? "text-danger" : hgo > 100 ? "text-success" : "text-navy-3"}`}>%{hgo.toFixed(1)}</span>;
}

function MagazaSatiri({ m }: { m: Magaza }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-50 text-xs">
      <div className="text-navy-3">{m.magaza_kodu} — {m.magaza_adi}</div>
      <div className="flex items-center gap-3">
        <DolulukRozeti dolu={m.dolu} norm={m.norm} />
        <HgoRozeti hgo={m.hgo} />
      </div>
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
          <span className="text-[10px] text-gray-400">
            {bolge.bmler.length > 0 ? `BM: ${bolge.bmler.map((b) => b.ad_soyad).join(", ")}` : "BM atanmamış"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <DolulukRozeti dolu={toplamDolu} norm={toplamNorm} />
          <HgoRozeti hgo={ortalamaHgo} />
        </div>
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
        <div className="flex items-center gap-3">
          <DolulukRozeti dolu={toplamDolu} norm={toplamNorm} />
          <HgoRozeti hgo={ortalamaHgo} />
        </div>
      </button>
      {acik && (
        <div className="p-2 space-y-1.5 bg-white">
          {ik.bolgeler.map((b) => <BolgeBloku key={b.id} bolge={b} />)}
        </div>
      )}
    </div>
  );
}

export default function RaporlarClient({ hiyerarsi, talepSureVeri, bolgeler }: {
  hiyerarsi: any; talepSureVeri: TalepSure[]; bolgeler: { id: string; ad: string }[];
}) {
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
    return Object.entries(gruplar).map(([tur, sureler]) => ({
      tur, etiket: TALEP_TURU_ETIKET[tur] ?? tur,
      ortalama: sureler.reduce((s, v) => s + v, 0) / sureler.length,
      adet: sureler.length,
    }));
  }, [kapanmisTalepler]);

  const enYavas = useMemo(() => kapanmisTalepler.slice().sort((a, b) => b.sure_gun - a.sure_gun).slice(0, 5), [kapanmisTalepler]);
  const enHizli = useMemo(() => kapanmisTalepler.slice().sort((a, b) => a.sure_gun - b.sure_gun).slice(0, 5), [kapanmisTalepler]);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-lg font-semibold text-navy-3">Raporlar</div>
        <div className="text-xs text-gray-400 mt-0.5">Hiyerarşik performans görünümü ve talep süreç süreleri</div>
      </div>

      {/* Filtreler */}
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
            <button key={g} onClick={() => setGunAraligi(g)}
              className={`px-2.5 py-1.5 text-[11px] font-medium ${gunAraligi === g ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              {g === "TUMU" ? "Tümü" : `Son ${g} gün`}
            </button>
          ))}
        </div>
      </div>

      {/* Hiyerarşik performans görünümü */}
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
          {((hiyerarsi.tip === "YONETIM" && hiyerarsi.ikler.length === 0) ||
            (hiyerarsi.tip === "IK" && hiyerarsi.bolgeler.length === 0) ||
            (hiyerarsi.tip === "BM" && hiyerarsi.magazalar.length === 0)) && (
            <div className="text-xs text-gray-400 text-center py-6">Görüntülenecek veri yok.</div>
          )}
        </div>
      </div>

      {/* Talep süreç süresi */}
      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-sm font-semibold text-navy-3 mb-3">
          Talep Süreç Süresi <span className="text-[11px] text-gray-400 font-normal">({kapanmisTalepler.length} kapanmış talep — açık talepler ortalamaya dahil edilmez)</span>
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
                  <span className="text-gray-500">{TALEP_TURU_ETIKET[t.talep_turu]}</span>
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
                  <span className="text-gray-500">{TALEP_TURU_ETIKET[t.talep_turu]}</span>
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
                <th className="text-left px-2 py-1.5">Durum</th>
                <th className="text-right px-2 py-1.5">Süre</th>
              </tr>
            </thead>
            <tbody>
              {filtrelenmisTalepler
                .slice()
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((t) => (
                  <tr key={t.id} className="border-t border-gray-50">
                    <td className="px-2 py-1.5 font-mono text-navy-3">{t.talep_no}</td>
                    <td className="px-2 py-1.5 text-gray-600">{TALEP_TURU_ETIKET[t.talep_turu] ?? t.talep_turu}</td>
                    <td className="px-2 py-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${DURUM_RENK[t.durum] ?? "bg-gray-100 text-gray-600"}`}>
                        {DURUM_ETIKET[t.durum] ?? t.durum}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-navy-3">
                      {t.sure_gun} gün{!t.kapanmis_mi && <span className="text-gray-400"> (devam ediyor)</span>}
                    </td>
                  </tr>
                ))}
              {filtrelenmisTalepler.length === 0 && (
                <tr><td colSpan={4} className="px-2 py-6 text-center text-gray-400">Bu filtreye uyan talep yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
