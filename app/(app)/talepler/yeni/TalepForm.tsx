"use client";

import { useState, useTransition } from "react";
import { createIseAlimTalebi } from "./actions";
import YeniMagazaModal from "./YeniMagazaModal";

type Pozisyon = { unvan: string; kategori: string };
type Bolge = { id: string; ad: string };

const KATEGORI_LABEL: Record<string, string> = {
  ANA_KADRO: "Ana Kadro",
  DONEMSEL: "Dönemsel",
  PART_TIME: "Part Time",
};

export default function TalepForm({
  magazalar,
  pozisyonlar,
  bolgeler,
}: {
  magazalar: { id: string; magaza_adi: string; magaza_kodu: string }[];
  pozisyonlar: Pozisyon[];
  bolgeler: Bolge[];
}) {
  const [pending, startTransition] = useTransition();
  const [normUyari, setNormUyari] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [israrli, setIsrarli] = useState(false);
  const [aciklama, setAciklama] = useState("");
  const [yeniMagazaModalAcik, setYeniMagazaModalAcik] = useState(false);

  const gruplar = Array.from(new Set(pozisyonlar.map((p) => p.kategori)));

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
    <>
    <form action={handleSubmit} className="bg-white border border-gray-200 rounded-card p-4 max-w-xl space-y-4">
      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Mağaza *</label>
        <select name="magaza_id" required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {magazalar.map((m) => (
            <option key={m.id} value={m.id}>{m.magaza_adi} ({m.magaza_kodu})</option>
          ))}
        </select>
        <button type="button" onClick={() => setYeniMagazaModalAcik(true)}
          className="text-[11px] text-info underline mt-1">
          Sistemde olmayan yeni bir mağaza/çadır/pop-up için mi talep açıyorsunuz?
        </button>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Pozisyon Tipi *</label>
        <select name="pozisyon_tipi" required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {gruplar.map((kategori) => (
            <optgroup key={kategori} label={KATEGORI_LABEL[kategori] ?? kategori}>
              {pozisyonlar.filter((p) => p.kategori === kategori).map((p) => (
                <option key={p.unvan} value={p.unvan}>{p.unvan}</option>
              ))}
            </optgroup>
          ))}
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
        <textarea name="aciklama" value={aciklama} onChange={(e) => setAciklama(e.target.value)}
          rows={3} required={israrli} minLength={israrli ? 100 : undefined}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        {israrli && (
          <div className={`text-[10px] mt-1 ${aciklama.trim().length >= 100 ? "text-success" : "text-gray-400"}`}>
            {aciklama.trim().length} / 100 karakter
          </div>
        )}
      </div>

      {error && <div className="text-xs text-danger">{error}</div>}

      <button type="submit" disabled={pending || (israrli && aciklama.trim().length < 100)} className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
        {pending ? "Gönderiliyor..." : "Talebi Gönder"}
      </button>
    </form>

    {yeniMagazaModalAcik && (
      <YeniMagazaModal
        bolgeler={bolgeler}
        pozisyonlar={pozisyonlar}
        onClose={() => setYeniMagazaModalAcik(false)}
        onDone={() => { setYeniMagazaModalAcik(false); window.location.href = "/talepler"; }}
      />
    )}
    </>
  );
}
