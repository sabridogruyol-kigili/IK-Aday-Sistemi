"use client";

import SurecTarihce, { type SurecAdimi } from "./SurecTarihce";

function tarihFormat(t: string | null): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SurecDetayModal({
  baslik, olaylar, yukleniyor, onClose,
}: { baslik: string; olaylar: SurecAdimi[]; yukleniyor: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-navy-3/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="text-sm font-semibold text-navy-3">Süreç Detayı — {baslik}</div>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>
        <div className="p-5">
          {yukleniyor ? (
            <div className="text-xs text-gray-400 py-10 text-center flex items-center justify-center gap-2">
              <span className="yukleniyor-donen" /> Yükleniyor...
            </div>
          ) : (
            <>
              <SurecTarihce olaylar={olaylar} />

              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="text-[11px] font-semibold text-navy-3 uppercase mb-2.5">Adım Açıklamaları</div>
                <div className="space-y-2">
                  {olaylar.map((o, i) => (
                    <div key={i} className="border border-gray-100 rounded-md px-3 py-2.5 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[12px] font-medium text-navy-3">{o.baslik}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{tarihFormat(o.tarih)}</div>
                      </div>
                      <div className={`text-[11px] ${o.detay ? "text-gray-600" : "text-gray-300 italic"}`}>
                        {o.detay || "Açıklama girilmemiş"}
                      </div>
                    </div>
                  ))}
                  {olaylar.length === 0 && (
                    <div className="text-[11px] text-gray-400 text-center py-3">Kayıtlı adım bulunamadı.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
