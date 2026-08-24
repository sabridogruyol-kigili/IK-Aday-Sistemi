"use client";

import { useState, useTransition } from "react";
import { createIseAlimTalebi } from "./actions";

const POZISYONLAR = ["Müdür", "Yardımcı", "SD", "Dönemsel", "Part Time"];

export default function TalepForm({ magazalar }: { magazalar: { id: string; magaza_adi: string; magaza_kodu: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [normUyari, setNormUyari] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [israrli, setIsrarli] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("israrli", String(israrli));
    startTransition(async () => {
      const sonuc = await createIseAlimTalebi(formData);
      if (sonuc?.norm_uyari) {
        setNormUyari(sonuc.norm_uyari);
      } else if (sonuc?.error) {
        setError(sonuc.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="bg-white border border-gray-200 rounded-card p-4 max-w-xl space-y-4">
      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Mağaza *</label>
        <select name="magaza_id" required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {magazalar.map((m) => (
            <option key={m.id} value={m.id}>{m.magaza_adi} ({m.magaza_kodu})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Pozisyon Tipi *</label>
        <select name="pozisyon_tipi" required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {POZISYONLAR.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Kişi Sayısı *</label>
        <input name="kisi_sayisi" type="number" min={1} required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>

      {normUyari && (
        <div className="bg-danger-bg border border-danger/30 rounded-md p-3 text-xs text-danger space-y-2">
          <div>{normUyari}</div>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={israrli} onChange={(e) => setIsrarli(e.target.checked)} />
            Yine de talep etmek istiyorum (açıklama zorunlu)
          </label>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
          Açıklama {israrli && "*"}
        </label>
        <textarea name="aciklama" rows={3} required={israrli} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>

      {error && <div className="text-xs text-danger">{error}</div>}

      <button type="submit" disabled={pending} className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
        {pending ? "Gönderiliyor..." : "Talebi Gönder"}
      </button>
    </form>
  );
}
