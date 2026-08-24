"use client";

import { useState, useTransition } from "react";
import { yonlendirAday } from "./actions";

type Talep = { id: string; talep_no: string; pozisyon_tipi: string; kisi_sayisi: number; magazalar: any };

export default function YonlendirForm({ talepler }: { talepler: Talep[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await yonlendirAday(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form action={handleSubmit} className="grid grid-cols-3 gap-3 items-end">
      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Talep *</label>
        <select name="talep_id" required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {talepler.map((t) => (
            <option key={t.id} value={t.id}>{t.talep_no} — {t.magazalar?.magaza_adi} — {t.pozisyon_tipi}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Aday Adı Soyadı *</label>
        <input name="ad_soyad" required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">CV Linki</label>
        <input name="cv_drive_link" placeholder="https://..." className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>
      <div className="col-span-3">
        <button type="submit" disabled={pending} className="bg-navy text-white rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-50">
          {pending ? "Gönderiliyor..." : "Yönlendir"}
        </button>
        {error && <div className="text-xs text-danger mt-2">{error}</div>}
      </div>
    </form>
  );
}
