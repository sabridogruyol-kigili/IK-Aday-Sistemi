"use client";

import { useMemo, useState } from "react";
import MagazaYorumModal from "./MagazaYorumModal";
import type { MagazaYorum } from "./actions-yorum";

type Satir = {
  id: string;
  magaza_kodu: string;
  magaza_adi: string;
  bolge_adi: string;
  ana_kadro_norm: number;
  ana_kadro_dolu: number;
  donemsel_norm: number;
  donemsel_dolu: number;
  part_time_norm: number;
  part_time_dolu: number;
  toplam_norm: number;
  toplam_dolu: number;
};

type Durum = "EKSIK" | "FAZLA" | "TAM";

const DURUM_ETIKET: Record<Durum, string> = { EKSIK: "Eksik Var", FAZLA: "Fazla Var (Eksik Yok)", TAM: "Tam" };
const DURUM_NOKTA: Record<Durum, string> = { EKSIK: "bg-danger", FAZLA: "bg-accent", TAM: "bg-success" };

function magazaDurumu(s: Satir): Durum {
  const anaFark = s.ana_kadro_dolu - s.ana_kadro_norm;
  const donemselFark = s.donemsel_dolu - s.donemsel_norm;
  const partFark = s.part_time_dolu - s.part_time_norm;
  if (anaFark < 0 || donemselFark < 0 || partFark < 0) return "EKSIK";
  if (anaFark > 0 || donemselFark > 0 || partFark > 0) return "FAZLA";
  return "TAM";
}

// Fark rengi: eksi (eksik) kırmızı, artı (fazla) turuncu, sıfır (tam) yeşil.
function farkRengi(fark: number): string {
  if (fark < 0) return "text-danger";
  if (fark > 0) return "text-accent";
  return "text-success";
}

function KadroGrubu({ norm, dolu }: { norm: number; dolu: number }) {
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

export default function NormTablosu({ satirlar, sonYorumlar, benimRolum }: {
  satirlar: Satir[];
  sonYorumlar: Record<string, Partial<Record<"IK" | "BM" | "YONETIM", MagazaYorum>>>;
  benimRolum: string;
}) {
  const [yorumModal, setYorumModal] = useState<{ magazaId: string; magazaAdi: string; rol: "IK" | "BM" | "YONETIM" } | null>(null);
  const [arama, setArama] = useState("");
  const [bolgeFiltre, setBolgeFiltre] = useState("");
  const [durumFiltre, setDurumFiltre] = useState<Set<Durum>>(new Set());

  const bolgeler = useMemo(
    () => Array.from(new Set(satirlar.map((s) => s.bolge_adi).filter(Boolean))).sort(),
    [satirlar]
  );

  const durumSayaclari = useMemo(() => {
    const sayac: Record<Durum, number> = { EKSIK: 0, FAZLA: 0, TAM: 0 };
    satirlar.forEach((s) => sayac[magazaDurumu(s)]++);
    return sayac;
  }, [satirlar]);

  function durumToggle(d: Durum) {
    setDurumFiltre((eski) => {
      const yeni = new Set(eski);
      if (yeni.has(d)) yeni.delete(d); else yeni.add(d);
      return yeni;
    });
  }

  const filtrelenmis = useMemo(() => {
    return satirlar.filter((s) => {
      if (bolgeFiltre && s.bolge_adi !== bolgeFiltre) return false;
      if (durumFiltre.size > 0 && !durumFiltre.has(magazaDurumu(s))) return false;
      if (arama) {
        const q = arama.toLocaleLowerCase("tr-TR");
        if (
          !s.magaza_adi.toLocaleLowerCase("tr-TR").includes(q) &&
          !s.magaza_kodu.toLocaleLowerCase("tr-TR").includes(q)
        ) return false;
      }
      return true;
    });
  }, [satirlar, bolgeFiltre, arama, durumFiltre]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap items-center">
          <select value={bolgeFiltre} onChange={(e) => setBolgeFiltre(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs">
            <option value="">Tüm Bölgeler (yetkiniz dahilinde)</option>
            {bolgeler.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <input value={arama} onChange={(e) => setArama(e.target.value)}
            placeholder="Mağaza adı / kodu ara..."
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1 max-w-xs" />
          {(Object.keys(DURUM_ETIKET) as Durum[]).map((d) => (
            <button
              key={d}
              onClick={() => durumToggle(d)}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] border ${
                durumFiltre.has(d) ? "border-navy bg-navy/5 text-navy-3 font-medium" : "border-gray-200 text-gray-500"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${DURUM_NOKTA[d]}`} />
              {DURUM_ETIKET[d]} ({durumSayaclari[d]})
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500 font-medium whitespace-nowrap">
          {filtrelenmis.length === satirlar.length ? `${satirlar.length} mağaza` : `${filtrelenmis.length} / ${satirlar.length} mağaza`}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-navy-3/70 uppercase tracking-wide border-b-2 border-navy">
              <th className="text-left p-3">Mağaza Kodu</th>
              <th className="text-left p-3">Mağaza Adı</th>
              <th className="text-left p-3">Bölge</th>
              <th className="text-center p-3 border-l border-gray-100">Ana Kadro</th>
              <th className="text-center p-3 border-l border-gray-100">Dönemsel</th>
              <th className="text-center p-3 border-l border-gray-100">Part-Time</th>
              <th className="text-center p-3 border-l border-gray-100 bg-gray-100/60">Toplam</th>
              <th className="text-left p-3 border-l border-gray-100">İK Yorum</th>
              <th className="text-left p-3 border-l border-gray-100">BM Yorum</th>
              <th className="text-left p-3 border-l border-gray-100">Yönetim Yorum</th>
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-400 text-xs">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-50">
                    <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
                  </svg>
                  Bu filtreye uyan mağaza bulunamadı — filtreleri gevşetmeyi deneyin.
                </td>
              </tr>
            )}
            {filtrelenmis.map((s) => {
              const durum = magazaDurumu(s);
              return (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="p-3 text-xs text-gray-500">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${DURUM_NOKTA[durum]}`} />
                    {s.magaza_kodu}
                  </td>
                  <td className="p-3 font-medium text-navy-3">{s.magaza_adi}</td>
                  <td className="p-3 text-xs text-gray-500">{s.bolge_adi}</td>
                  <td className="p-3 border-l border-gray-50"><KadroGrubu norm={s.ana_kadro_norm} dolu={s.ana_kadro_dolu} /></td>
                  <td className="p-3 border-l border-gray-50"><KadroGrubu norm={s.donemsel_norm} dolu={s.donemsel_dolu} /></td>
                  <td className="p-3 border-l border-gray-50"><KadroGrubu norm={s.part_time_norm} dolu={s.part_time_dolu} /></td>
                  <td className="p-3 border-l border-gray-50 bg-gray-50/60"><KadroGrubu norm={s.toplam_norm} dolu={s.toplam_dolu} /></td>
                  {(["IK", "BM", "YONETIM"] as const).map((rol) => {
                    const son = sonYorumlar[s.id]?.[rol];
                    return (
                      <td key={rol} className="p-3 border-l border-gray-50 align-top max-w-[160px]">
                        {son ? (
                          <>
                            <div className="text-[11px] text-gray-600 line-clamp-2">{son.yorum}</div>
                            <div className="text-[9px] text-gray-400 mt-0.5">
                              {son.yazan_ad_soyad} · {new Date(son.created_at).toLocaleDateString("tr-TR")}
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] text-gray-300 italic">Yorum yok</div>
                        )}
                        <button
                          onClick={() => setYorumModal({ magazaId: s.id, magazaAdi: s.magaza_adi, rol })}
                          className="text-[10px] font-medium bg-white border border-info/40 text-info hover:bg-info/5 rounded-md px-1.5 py-0.5 mt-1 transition-colors"
                        >
                          Detay
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {yorumModal && (
        <MagazaYorumModal
          magazaId={yorumModal.magazaId}
          magazaAdi={yorumModal.magazaAdi}
          rol={yorumModal.rol}
          benimRolum={benimRolum}
          onClose={() => setYorumModal(null)}
        />
      )}
    </div>
  );
}
