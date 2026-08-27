"use client";

import { useState, useTransition } from "react";
import { createIseAlimTalebiToplu } from "./actions-coklu";
import YeniMagazaModal from "./YeniMagazaModal";

type Pozisyon = { unvan: string; kategori: string };
type Bolge = { id: string; ad: string };
type PozisyonSatiri = { id: string; pozisyon_tipi: string; kisi_sayisi: number };

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
  const [magazaId, setMagazaId] = useState("");
  const [yeniMagazaModalAcik, setYeniMagazaModalAcik] = useState(false);
  const [satirlar, setSatirlar] = useState<PozisyonSatiri[]>([
    { id: crypto.randomUUID(), pozisyon_tipi: "", kisi_sayisi: 1 },
  ]);

  const gruplar = Array.from(new Set(pozisyonlar.map((p) => p.kategori)));

  function satirEkle() {
    setSatirlar((s) => [...s, { id: crypto.randomUUID(), pozisyon_tipi: "", kisi_sayisi: 1 }]);
  }
  function satirSil(id: string) {
    setSatirlar((s) => (s.length > 1 ? s.filter((r) => r.id !== id) : s));
  }
  function satirGuncelle(id: string, alan: "pozisyon_tipi" | "kisi_sayisi", deger: string) {
    setSatirlar((s) => s.map((r) => (r.id === id ? { ...r, [alan]: alan === "kisi_sayisi" ? Number(deger) : deger } : r)));
  }

  const gecerliMi = magazaId && satirlar.every((s) => s.pozisyon_tipi && s.kisi_sayisi >= 1);

  function gonder() {
    if (!gecerliMi) return;
    setError(null);
    setNormUyari(null);
    const fd = new FormData();
    fd.set("magaza_id", magazaId);
    fd.set("israrli", String(israrli));
    fd.set("aciklama", aciklama);
    fd.set("pozisyonlar", JSON.stringify(satirlar.map((s) => ({ pozisyon_tipi: s.pozisyon_tipi, kisi_sayisi: s.kisi_sayisi }))));
    startTransition(async () => {
      const res = await createIseAlimTalebiToplu(fd);
      if (res?.norm_uyari) { setNormUyari(res.norm_uyari); return; }
      if (res?.error) { setError(res.error); return; }
      window.location.href = "/talepler";
    });
  }

  return (
    <>
    <div className="bg-white border border-gray-200 rounded-card p-4 max-w-xl space-y-4">
      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Mağaza *</label>
        <select value={magazaId} onChange={(e) => setMagazaId(e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
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
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[10px] font-semibold text-navy-3 uppercase">Pozisyonlar *</label>
          <button onClick={satirEkle} type="button" className="text-[11px] text-info underline">+ Pozisyon Ekle</button>
        </div>
        <div className="space-y-2">
          {satirlar.map((satir) => (
            <div key={satir.id} className="flex gap-2 items-center">
              <select value={satir.pozisyon_tipi} onChange={(e) => satirGuncelle(satir.id, "pozisyon_tipi", e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-xs">
                <option value="">Pozisyon seçin</option>
                {gruplar.map((kategori) => (
                  <optgroup key={kategori} label={KATEGORI_LABEL[kategori] ?? kategori}>
                    {pozisyonlar.filter((p) => p.kategori === kategori).map((p) => (
                      <option key={p.unvan} value={p.unvan}>{p.unvan}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input type="number" min={1} value={satir.kisi_sayisi}
                onChange={(e) => satirGuncelle(satir.id, "kisi_sayisi", e.target.value)}
                className="w-16 border border-gray-300 rounded-md px-2 py-1.5 text-xs" />
              <button onClick={() => satirSil(satir.id)} type="button" disabled={satirlar.length <= 1}
                className="text-gray-400 hover:text-danger disabled:opacity-30 text-xs px-1">✕</button>
            </div>
          ))}
        </div>
        {satirlar.length > 1 && (
          <div className="text-[10px] text-gray-400 mt-1">
            Her pozisyon için ayrı bir talep oluşturulur (aynı ana talep numarasının altında), her biri kendi onay sürecinden bağımsız ilerler.
          </div>
        )}
      </div>

      {normUyari && (
        <div className="bg-danger-bg border border-danger/30 rounded-md p-3 text-xs text-danger space-y-2 whitespace-pre-line">
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
        <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)}
          rows={3} minLength={israrli ? 100 : undefined}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        {israrli && (
          <div className={`text-[10px] mt-1 ${aciklama.trim().length >= 100 ? "text-success" : "text-gray-400"}`}>
            {aciklama.trim().length} / 100 karakter
          </div>
        )}
      </div>

      {error && <div className="text-xs text-danger">{error}</div>}

      <button onClick={gonder} disabled={pending || !gecerliMi || (israrli && aciklama.trim().length < 100)}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
        {pending ? "Gönderiliyor..." : satirlar.length > 1 ? `${satirlar.length} Talep Gönder` : "Talebi Gönder"}
      </button>
    </div>

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
