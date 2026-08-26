"use client";

import { useState, useTransition } from "react";
import { createYeniMagazaTalebi } from "./actions-yenimagaza";

type Pozisyon = { unvan: string; kategori: string };
type Bolge = { id: string; ad: string };

const KATEGORI_LABEL: Record<string, string> = {
  ANA_KADRO: "Ana Kadro",
  DONEMSEL: "Dönemsel",
  PART_TIME: "Part Time",
};

type PozisyonSatiri = { id: string; pozisyon_tipi: string; kisi_sayisi: number };

export default function YeniMagazaModal({
  bolgeler,
  pozisyonlar,
  onClose,
  onDone,
}: {
  bolgeler: Bolge[];
  pozisyonlar: Pozisyon[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [magazaKodu, setMagazaKodu] = useState("");
  const [magazaAdi, setMagazaAdi] = useState("");
  const [bolgeId, setBolgeId] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [satirlar, setSatirlar] = useState<PozisyonSatiri[]>([
    { id: crypto.randomUUID(), pozisyon_tipi: "", kisi_sayisi: 1 },
  ]);
  const [error, setError] = useState<string | null>(null);

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

  const gecerliMi =
    magazaKodu.trim() && magazaAdi.trim() && bolgeId &&
    satirlar.every((s) => s.pozisyon_tipi && s.kisi_sayisi >= 1);

  function gonder() {
    if (!gecerliMi) return;
    setError(null);
    const fd = new FormData();
    fd.set("magaza_kodu", magazaKodu.trim());
    fd.set("magaza_adi", magazaAdi.trim());
    fd.set("bolge_id", bolgeId);
    fd.set("aciklama", aciklama);
    fd.set("pozisyonlar", JSON.stringify(satirlar.map((s) => ({ pozisyon_tipi: s.pozisyon_tipi, kisi_sayisi: s.kisi_sayisi }))));
    startTransition(async () => {
      const res = await createYeniMagazaTalebi(fd);
      if (res?.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 bg-navy-3/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-navy-3">Yeni Mağaza / Çadır / Pop-up Açılışı</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Birden fazla pozisyon tek seferde, tek grup altında talep edilir</div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Mağaza Kodu *</label>
              <input value={magazaKodu} onChange={(e) => setMagazaKodu(e.target.value)}
                placeholder="Örn. A050" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Bölge *</label>
              <select value={bolgeId} onChange={(e) => setBolgeId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
                <option value="">Seçin</option>
                {bolgeler.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Mağaza / Çadır / Pop-up Adı *</label>
            <input value={magazaAdi} onChange={(e) => setMagazaAdi(e.target.value)}
              placeholder="Örn. İstanbul Vadi Pop-up" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
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
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Açıklama (opsiyonel)</label>
            <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={2}
              placeholder="Boş bırakılırsa otomatik açıklama kullanılır"
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          </div>

          <div className="bg-info-bg text-info text-[11px] rounded-md p-2.5">
            Her pozisyon için ayrı bir talep oluşturulur (aynı ana talep numarasının altında, örn. 2026-0011-1, 2026-0011-2 ...),
            her biri kendi onay sürecinden (BM + İK + Yönetim, açan hariç) bağımsız ilerler ve ayrı ayrı aday/CV süreci başlatılabilir.
            Mağazanın normu, girdiğiniz kişi sayılarına göre otomatik oluşturulur.
          </div>

          {error && <div className="text-[11px] text-danger">{error}</div>}

          <button onClick={gonder} disabled={pending || !gecerliMi}
            className="w-full bg-navy text-white rounded-md py-2 text-sm font-medium disabled:opacity-50">
            {pending ? "Oluşturuluyor..." : `${satirlar.length} Talep Oluştur`}
          </button>
        </div>
      </div>
    </div>
  );
}
