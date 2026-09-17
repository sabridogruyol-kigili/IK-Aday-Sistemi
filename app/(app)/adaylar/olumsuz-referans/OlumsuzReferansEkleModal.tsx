"use client";

import { useState, useTransition } from "react";
import { olumsuzReferansaEkle } from "./actions";

// Hem Olumsuz Referans Listesi sayfasından (TC serbest girilir) hem de
// Personel Detay'dan (TC ve Ad Soyad hazır dolu, salt okunur gelir) çağrılan ortak modal.
export default function OlumsuzReferansEkleModal({
  onClose, onEklendi, tcKimlikNo, adSoyad,
}: {
  onClose: () => void;
  onEklendi?: () => void;
  tcKimlikNo?: string;
  adSoyad?: string;
}) {
  const [tc, setTc] = useState(tcKimlikNo ?? "");
  const [ad, setAd] = useState(adSoyad ?? "");
  const [aciklama, setAciklama] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [basarili, setBasarili] = useState(false);
  const [pending, startTransition] = useTransition();

  const tcSabit = !!tcKimlikNo;
  const adSabit = !!adSoyad;

  function gonder() {
    setHata(null);
    startTransition(async () => {
      const sonuc = await olumsuzReferansaEkle(tc, ad, aciklama);
      if (sonuc?.error) { setHata(sonuc.error); return; }
      setBasarili(true);
      onEklendi?.();
    });
  }

  return (
    <div className="fixed inset-0 bg-navy-3/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-navy-3">Olumsuz Referans Listesine Ekle</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        {basarili ? (
          <div className="text-xs text-success bg-success/10 rounded-md p-3">Eklendi.</div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">TC Kimlik No *</label>
              <input
                value={tc}
                disabled={tcSabit}
                onChange={(e) => setTc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="numeric"
                placeholder="11 haneli TC kimlik no"
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Ad Soyad *</label>
              <input
                value={ad}
                disabled={adSabit}
                onChange={(e) => setAd(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Açıklama / Gerekçe *</label>
              <textarea
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                rows={3}
                placeholder="Olumsuz referans gerekçesi..."
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div className="text-[10px] text-gray-400 bg-gray-50 rounded-md p-2">
              Yönetim eklerse anında etkin olur. BM/İK eklerse Yönetim onayı beklenir.
            </div>
            {hata && <div className="text-[11px] text-danger bg-danger-bg rounded-md px-2 py-1.5">{hata}</div>}
            <button
              onClick={gonder}
              disabled={pending || !/^\d{11}$/.test(tc) || !ad.trim() || aciklama.trim().length < 10}
              className="w-full bg-danger text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Kaydediliyor..." : "Listeye Ekle"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
