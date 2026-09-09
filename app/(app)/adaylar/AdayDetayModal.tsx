"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getAdayEslesenPersonelDetay, type AdayDetay } from "./actions";

const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function BilgiSatiri({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase">{label}</div>
      <div className="text-navy-3 font-medium">{value || "—"}</div>
    </div>
  );
}

export default function AdayDetayModal({
  onClose, adSoyad, telefon, email, magaza, talepNo, durumEtiket, tcKimlikNo,
}: {
  onClose: () => void;
  adSoyad: string; telefon: string | null; email: string | null; magaza?: string;
  talepNo: string; durumEtiket: string; tcKimlikNo: string | null;
}) {
  const [detay, setDetay] = useState<AdayDetay | null>(null);
  const [yukleniyor, setYukleniyor] = useState(!!tcKimlikNo);

  useEffect(() => {
    if (!tcKimlikNo) { setYukleniyor(false); return; }
    getAdayEslesenPersonelDetay(tcKimlikNo).then((veri) => {
      setDetay(veri);
      setYukleniyor(false);
    });
  }, [tcKimlikNo]);

  const hgoGrafikVerisi = (detay?.hgoGecmisi ?? [])
    .filter((h) => h.hgo !== null)
    .map((h) => ({ etiket: `${AY_KISA[h.ay]} ${String(h.yil).slice(2)}`, hgo: h.hgo }));

  return (
    <div className="fixed inset-0 bg-navy-3/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
          <div className="text-sm font-semibold text-navy-3">{adSoyad}</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div className="p-4 space-y-4">
          {yukleniyor ? (
            <div className="text-xs text-gray-400 py-4 text-center flex items-center justify-center gap-2">
              <span className="yukleniyor-donen" /> Kontrol ediliyor...
            </div>
          ) : detay?.eslesenPersonelVarMi ? (
            <div className="space-y-3">
              <div className="text-[11px] text-success bg-success-bg rounded-md px-2 py-1.5 font-medium">
                Bu kişi sistemde eşleşen bir personel kaydına sahip — performans bilgisi bulundu.
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-md px-2.5 py-2">
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Ort. HGO</div>
                  <div className="text-sm font-mono font-semibold text-navy-3">
                    {detay.performansOrtalamaHgo != null ? `%${detay.performansOrtalamaHgo.toFixed(1)}` : "—"}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-md px-2.5 py-2">
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Kıdem</div>
                  <div className="text-sm font-mono font-semibold text-navy-3">
                    {detay.kidemAy != null ? `${Math.floor(detay.kidemAy / 12)}y ${detay.kidemAy % 12}a` : "—"}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-md px-2.5 py-2">
                  <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Kan Grubu</div>
                  <div className="text-sm font-mono font-semibold text-navy-3">{detay.kanGrubu ?? "—"}</div>
                </div>
              </div>
              {hgoGrafikVerisi.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-navy-3 mb-1">HGO (Ciro) — Aylık</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={hgoGrafikVerisi} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="etiket" tick={{ fontSize: 8 }} />
                      <YAxis tick={{ fontSize: 8 }} />
                      <Tooltip formatter={(v: number) => `%${v.toFixed(1)}`} labelStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="hgo" stroke="#0F1B4D" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-gray-400 bg-gray-50 rounded-md px-2 py-1.5">
              {tcKimlikNo ? "TC ile eşleşen bir personel/performans kaydı bulunamadı." : "Bu aday henüz işe alınmadı — TC girilmediği için performans kontrolü yapılamıyor."}
            </div>
          )}

          {/* Temel kişi bilgileri — performans olsun olmasın HER ZAMAN gösterilir. */}
          <div className="pt-3 border-t border-gray-100">
            <div className="text-[11px] font-semibold text-navy-3 mb-2">Kişi Bilgileri</div>
            <div className="grid grid-cols-2 gap-2.5 text-[11px]">
              <BilgiSatiri label="Telefon" value={telefon} />
              <BilgiSatiri label="E-posta" value={email} />
              <BilgiSatiri label="Mağaza" value={magaza} />
              <BilgiSatiri label="Talep No" value={talepNo} />
              <BilgiSatiri label="Süreç Durumu" value={durumEtiket} />
              <BilgiSatiri label="TC Kimlik No" value={tcKimlikNo} />
              {detay?.eslesenPersonelVarMi && (
                <>
                  <BilgiSatiri label="Görev Yeri (İl)" value={detay.ilAdi} />
                  <BilgiSatiri label="Uyruk" value={detay.uyruk} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
