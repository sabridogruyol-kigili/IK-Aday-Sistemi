"use client";

import { useEffect, useState } from "react";
import {
  getPersonelDetay, getPersonelPerformansGecmisi, getPersonelIsGecmisi, getKisiPerformansSirketOrtalamasi,
  type PersonelDetay, type PersonelAylikHgo, type PersonelIsGecmisiSatiri, type KisiPerformansOrtalama,
} from "../talepler/yeni/actions-cikarma";
import { hassasAlanGetir } from "./actions-hassas";
import KisiGrafikPaneli from "../talepler/yeni/KisiGrafikPaneli";
import { kidemYilAyFormat } from "@/lib/kidemFormat";
import OlumsuzReferansEkleModal from "../adaylar/olumsuz-referans/OlumsuzReferansEkleModal";
import HassasAlanGoster from "@/lib/HassasAlanGoster";
import BrutMaasGoster from "@/lib/BrutMaasGoster";
import BedenOlculeriGoster from "@/lib/BedenOlculeriGoster";

function OzlukAlani({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase">{label}</div>
      <div className="text-navy-3 font-medium">{value || "—"}</div>
    </div>
  );
}

function HassasOzlukAlani({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase">{label}</div>
      <div className="text-navy-3 font-medium">{children}</div>
    </div>
  );
}

function MiniKpi({ label, value, vurgu }: { label: string; value: string; vurgu?: boolean }) {
  return (
    <div className={`rounded-md px-2.5 py-2 ${vurgu ? "bg-danger-bg" : "bg-gray-50"}`}>
      <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-semibold ${vurgu ? "text-danger" : "text-navy-3"}`}>{value}</div>
    </div>
  );
}

function tarihFormat(t: string | null): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function PersonelDetayModal({
  personelId, adSoyad, guncelUnvan, magazaAdi, onClose,
}: {
  personelId: string; adSoyad: string; guncelUnvan: string; magazaAdi: string; onClose: () => void;
}) {
  const [detay, setDetay] = useState<PersonelDetay | null>(null);
  const [gecmis, setGecmis] = useState<PersonelAylikHgo[]>([]);
  const [isGecmisi, setIsGecmisi] = useState<PersonelIsGecmisiSatiri[]>([]);
  const [sirketOrtalamasi, setSirketOrtalamasi] = useState<KisiPerformansOrtalama[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [olumsuzReferansModalAcik, setOlumsuzReferansModalAcik] = useState(false);
  const [olumsuzReferansTc, setOlumsuzReferansTc] = useState<string | null>(null);
  const [olumsuzReferansYukleniyor, setOlumsuzReferansYukleniyor] = useState(false);
  const [olumsuzReferansHata, setOlumsuzReferansHata] = useState<string | null>(null);

  useEffect(() => {
    setYukleniyor(true);
    Promise.all([
      getPersonelDetay(personelId),
      getPersonelPerformansGecmisi(personelId),
      getPersonelIsGecmisi(personelId),
      getKisiPerformansSirketOrtalamasi(),
    ]).then(([d, g, i, o]) => {
      setDetay(d);
      setGecmis(g);
      setIsGecmisi(i);
      setSirketOrtalamasi(o);
      setYukleniyor(false);
    });
  }, [personelId]);

  const ortalamaHgo = gecmis.filter((g) => g.hgo != null).length > 0
    ? gecmis.reduce((s, g) => s + (g.hgo ?? 0), 0) / gecmis.filter((g) => g.hgo != null).length
    : null;

  // "Olumsuz Referansa Ekle" TC gerektirir — TC hiçbir zaman burada state'te
  // saklı tutulmaz, butona basılınca anlık istenir (yetkisi yoksa burada engellenir
  // ve denetim kaydına düşer).
  async function olumsuzReferansAc() {
    setOlumsuzReferansHata(null);
    setOlumsuzReferansYukleniyor(true);
    const sonuc = await hassasAlanGetir("personel", personelId, "tc_kimlik_no");
    setOlumsuzReferansYukleniyor(false);
    if (sonuc.error || !sonuc.deger) {
      setOlumsuzReferansHata(sonuc.error ?? "TC Kimlik No bulunamadı.");
      return;
    }
    setOlumsuzReferansTc(sonuc.deger);
    setOlumsuzReferansModalAcik(true);
  }

  return (
    <div className="fixed inset-0 bg-navy-3/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <div className="text-sm font-semibold text-navy-3">{adSoyad}</div>
            <div className="text-[11px] text-gray-400">{guncelUnvan} — {magazaAdi}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={olumsuzReferansAc}
              disabled={!detay?.tc_var || olumsuzReferansYukleniyor}
              title={!detay?.tc_var ? "TC Kimlik No bulunamadı" : "Olumsuz Referans Listesine Ekle"}
              className="text-[10px] font-medium bg-white border border-danger/40 text-danger hover:bg-danger-bg rounded-md px-2 py-1 transition-colors disabled:opacity-40"
            >
              {olumsuzReferansYukleniyor ? "Kontrol ediliyor…" : "Olumsuz Referansa Ekle"}
            </button>
            <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {olumsuzReferansHata && (
            <div className="text-[11px] text-danger bg-danger-bg rounded-md px-2.5 py-1.5">{olumsuzReferansHata}</div>
          )}

          {yukleniyor ? (
            <div className="text-xs text-gray-400 py-8 text-center flex items-center justify-center gap-2">
              <span className="yukleniyor-donen" /> Yükleniyor...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <MiniKpi label="Ort. HGO" value={ortalamaHgo != null ? `%${ortalamaHgo.toFixed(1)}` : "—"} vurgu={ortalamaHgo != null && ortalamaHgo < 80} />
                <MiniKpi label="Kıdem" value={detay?.kidem_ay != null ? kidemYilAyFormat(detay.kidem_ay) : "—"} />
              </div>

              <KisiGrafikPaneli
                gecmis={gecmis}
                yukleniyor={false}
                varsayilanDegisken="hgo"
                hgoYuksek={ortalamaHgo != null && ortalamaHgo < 80}
                sirketOrtalamasi={sirketOrtalamasi}
              />

              <div className="pt-3 border-t border-gray-100">
                <div className="text-[11px] font-semibold text-navy-3 mb-2">Kişi Bilgileri</div>
                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <HassasOzlukAlani label="TC Kimlik No">
                    <HassasAlanGoster hedefTablo="personel" hedefId={personelId} alan="tc_kimlik_no" gorebilir={detay?.gorunurlukler.tc_kimlik_no ?? false} placeholder="•••••••••••" />
                  </HassasOzlukAlani>
                  <OzlukAlani label="Personel Kodu" value={detay?.personel_kodu ?? null} />
                  <HassasOzlukAlani label="Doğum Tarihi">
                    <HassasAlanGoster hedefTablo="personel" hedefId={personelId} alan="dogum_tarihi" gorebilir={detay?.gorunurlukler.dogum_tarihi ?? false} placeholder="••.••.••••" />
                  </HassasOzlukAlani>
                  <HassasOzlukAlani label="Kan Grubu">
                    <HassasAlanGoster hedefTablo="personel" hedefId={personelId} alan="kan_grubu_kodu" gorebilir={detay?.gorunurlukler.kan_grubu_kodu ?? false} placeholder="••" />
                  </HassasOzlukAlani>
                  <OzlukAlani label="Uyruk" value={detay?.uyruk ?? null} />
                  <OzlukAlani label="Medeni Hal" value={detay?.evli ?? null} />
                  <OzlukAlani label="Görev Yeri (İl)" value={detay?.il_adi ?? null} />
                  <OzlukAlani label="İşe Giriş Tarihi" value={detay?.ise_giris_tarihi ? new Date(detay.ise_giris_tarihi).toLocaleDateString("tr-TR") : null} />
                  <HassasOzlukAlani label="Cep Telefonu">
                    <HassasAlanGoster hedefTablo="personel" hedefId={personelId} alan="ozel_mobil" gorebilir={detay?.gorunurlukler.ozel_mobil ?? false} placeholder="••• ••• •• ••" />
                  </HassasOzlukAlani>
                  <OzlukAlani label="Önceki İş Yeri" value={detay?.onceki_is_yeri ?? null} />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <div className="text-[11px] font-semibold text-navy-3 mb-2">Brüt Maaş / Kıdem Tazminatı Tahmini</div>
                <BrutMaasGoster personelId={personelId} gorebilir={detay?.gorunurlukler.brut_maas ?? false} />
              </div>

              <div className="pt-3 border-t border-gray-100">
                <div className="text-[11px] font-semibold text-navy-3 mb-2">Beden Ölçüleri</div>
                <BedenOlculeriGoster personelId={personelId} gorebilir={detay?.gorunurlukler.beden_olculeri ?? false} />
              </div>

              {(Number(detay?.ihtarname) > 0 || Number(detay?.uyari_yazisi) > 0 || Number(detay?.tutanak) > 0 || Number(detay?.savunma) > 0) && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="text-[11px] font-semibold text-navy-3 mb-2">Disiplin Kayıtları (Adet)</div>
                  <div className="grid grid-cols-4 gap-2">
                    <MiniKpi label="İhtarname" value={String(Number(detay?.ihtarname) || 0)} vurgu={(Number(detay?.ihtarname) || 0) > 0} />
                    <MiniKpi label="Uyarı" value={String(Number(detay?.uyari_yazisi) || 0)} vurgu={(Number(detay?.uyari_yazisi) || 0) > 0} />
                    <MiniKpi label="Tutanak" value={String(Number(detay?.tutanak) || 0)} />
                    <MiniKpi label="Savunma" value={String(Number(detay?.savunma) || 0)} />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100">
                <div className="text-[11px] font-semibold text-navy-3 mb-2">
                  Çalıştığı Mağazalar <span className="text-gray-400 font-normal">({isGecmisi.length})</span>
                </div>
                {isGecmisi.length === 0 ? (
                  <div className="text-xs text-gray-400 py-3 text-center">Atama geçmişi bulunamadı.</div>
                ) : (
                  <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-md">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase sticky top-0">
                          <th className="text-left px-2 py-1.5">Mağaza</th>
                          <th className="text-right px-2 py-1.5">Başlama</th>
                          <th className="text-right px-2 py-1.5">Ayrılma</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isGecmisi.map((s, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="px-2 py-1.5 text-navy-3 font-medium">{s.magaza_adi}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-gray-600">{tarihFormat(s.baslama_tarihi)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-gray-600">
                              {s.ayrilma_tarihi ? tarihFormat(s.ayrilma_tarihi) : <span className="text-success">Devam ediyor</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {detay?.notlar && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="text-[11px] font-semibold text-navy-3 mb-1">Notlar</div>
                  <div className="text-[11px] text-gray-600 bg-gray-50 rounded-md p-2">{detay.notlar}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {olumsuzReferansModalAcik && olumsuzReferansTc && (
        <OlumsuzReferansEkleModal
          onClose={() => setOlumsuzReferansModalAcik(false)}
          tcKimlikNo={olumsuzReferansTc}
          adSoyad={adSoyad}
        />
      )}
    </div>
  );
}
