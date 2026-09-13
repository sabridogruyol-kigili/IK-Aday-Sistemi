"use client";

import SurecTarihce, { type SurecAdimi } from "./SurecTarihce";

export default function SurecDetayModal({
  baslik, olaylar, yukleniyor, onClose,
}: { baslik: string; olaylar: SurecAdimi[]; yukleniyor: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-navy-3/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
          <div className="text-sm font-semibold text-navy-3">Süreç Detayı — {baslik}</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>
        <div className="p-4">
          {yukleniyor ? (
            <div className="text-xs text-gray-400 py-8 text-center flex items-center justify-center gap-2">
              <span className="yukleniyor-donen" /> Yükleniyor...
            </div>
          ) : (
            <SurecTarihce olaylar={olaylar} />
          )}
        </div>
      </div>
    </div>
  );
}
