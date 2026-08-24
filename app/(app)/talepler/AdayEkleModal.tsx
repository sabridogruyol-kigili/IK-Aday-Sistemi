"use client";

import { useState, useTransition } from "react";
import { yonlendirAday } from "../adaylar/actions";

export default function AdayEkleModal({ talepId, onClose, onDone }: {
  talepId: string; onClose: () => void; onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [adSoyad, setAdSoyad] = useState("");
  const [dogumTarihi, setDogumTarihi] = useState("");
  const [cinsiyet, setCinsiyet] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  function ekle() {
    if (!adSoyad.trim()) return;
    setHata(null);
    const fd = new FormData();
    fd.set("talep_id", talepId);
    fd.set("ad_soyad", adSoyad);
    fd.set("dogum_tarihi", dogumTarihi);
    fd.set("cinsiyet", cinsiyet);
    startTransition(async () => {
      const res = await yonlendirAday(fd);
      if (res?.error) {
        setHata(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 bg-navy-3/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-navy-3">Yeni Aday Ekle</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Ad Soyad *</label>
            <input value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" autoFocus />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Doğum Tarihi</label>
            <input type="date" value={dogumTarihi} onChange={(e) => setDogumTarihi(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Cinsiyet</label>
            <select value={cinsiyet} onChange={(e) => setCinsiyet(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
              <option value="">Seçin</option>
              <option value="Kadın">Kadın</option>
              <option value="Erkek">Erkek</option>
              <option value="Belirtilmedi">Belirtilmedi</option>
            </select>
          </div>

          {hata && <div className="text-[11px] text-danger">{hata}</div>}

          <button onClick={ekle} disabled={pending || !adSoyad.trim()}
            className="w-full bg-navy text-white rounded-md py-2 text-sm font-medium disabled:opacity-50">
            {pending ? "Ekleniyor..." : "Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}
