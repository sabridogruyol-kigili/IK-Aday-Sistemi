"use client";

import { useMemo, useState, useTransition } from "react";
import { createNormDegisiklikTalebi } from "./actions-norm-talebi";

type Magaza = {
  id: string;
  magaza_adi: string;
  magaza_kodu: string;
  bolge_adi: string;
  ana_kadro_norm: number;
  donemsel_norm: number;
  part_time_norm: number;
};

const KATEGORI_LABEL: Record<string, string> = {
  ANA_KADRO: "Ana Kadro Norm",
  DONEMSEL: "Dönemsel Norm",
  PART_TIME: "Part-Time Norm",
};

export default function NormTalebiForm({ magazalar }: { magazalar: Magaza[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bolgeFiltre, setBolgeFiltre] = useState("");
  const [magazaId, setMagazaId] = useState("");
  const [kategori, setKategori] = useState("");
  const [yeniDeger, setYeniDeger] = useState("");
  const [aciklama, setAciklama] = useState("");

  const bolgeler = useMemo(() => Array.from(new Set(magazalar.map((m) => m.bolge_adi).filter(Boolean))).sort(), [magazalar]);
  const filtrelenmisMagazalar = useMemo(
    () => (bolgeFiltre ? magazalar.filter((m) => m.bolge_adi === bolgeFiltre) : magazalar),
    [magazalar, bolgeFiltre]
  );
  const seciliMagaza = magazalar.find((m) => m.id === magazaId) ?? null;

  const eskiDeger = seciliMagaza && kategori
    ? kategori === "ANA_KADRO" ? seciliMagaza.ana_kadro_norm
      : kategori === "DONEMSEL" ? seciliMagaza.donemsel_norm
      : seciliMagaza.part_time_norm
    : null;

  const yeniDegerSayi = yeniDeger === "" ? null : parseInt(yeniDeger, 10);
  const fark = eskiDeger != null && yeniDegerSayi != null ? yeniDegerSayi - eskiDeger : null;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const sonuc = await createNormDegisiklikTalebi(formData);
      if (sonuc?.error) setError(sonuc.error);
    });
  }

  return (
    <form action={handleSubmit} className="bg-white border border-gray-200 rounded-card p-4 max-w-xl space-y-4">
      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Bölge (filtre)</label>
        <select value={bolgeFiltre} onChange={(e) => { setBolgeFiltre(e.target.value); setMagazaId(""); }}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Tüm Bölgeler (yetkiniz dahilinde)</option>
          {bolgeler.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Mağaza *</label>
        <select name="magaza_id" required value={magazaId} onChange={(e) => setMagazaId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {filtrelenmisMagazalar.map((m) => (
            <option key={m.id} value={m.id}>{m.magaza_kodu} — {m.magaza_adi}</option>
          ))}
        </select>
      </div>

      {seciliMagaza && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs grid grid-cols-3 gap-2">
          <div><div className="text-[9px] text-gray-400 uppercase">Ana Kadro</div><div className="font-mono font-semibold text-navy-3">{seciliMagaza.ana_kadro_norm}</div></div>
          <div><div className="text-[9px] text-gray-400 uppercase">Dönemsel</div><div className="font-mono font-semibold text-navy-3">{seciliMagaza.donemsel_norm}</div></div>
          <div><div className="text-[9px] text-gray-400 uppercase">Part-Time</div><div className="font-mono font-semibold text-navy-3">{seciliMagaza.part_time_norm}</div></div>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Norm Kategorisi *</label>
        <select name="norm_kategorisi" required value={kategori} onChange={(e) => setKategori(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {Object.entries(KATEGORI_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {kategori && (
        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
            Yeni {KATEGORI_LABEL[kategori]} Sayısı * <span className="text-gray-400 normal-case font-normal">(mevcut: {eskiDeger})</span>
          </label>
          <input name="norm_yeni_deger" type="number" min={0} required value={yeniDeger}
            onChange={(e) => setYeniDeger(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          {fark !== null && fark !== 0 && (
            <div className={`text-[11px] mt-1 font-medium ${fark > 0 ? "text-accent" : "text-danger"}`}>
              {fark > 0 ? `+${fark} artırılıyor` : `${fark} azaltılıyor`}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Açıklama / Gerekçe *</label>
        <textarea name="aciklama" required rows={3} value={aciklama} onChange={(e) => setAciklama(e.target.value)}
          placeholder="Norm değişikliğinin gerekçesini yazın..."
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>

      <div className="text-[10px] text-gray-400 bg-gray-50 rounded-md p-2">
        Bu talep, açan hariç BM/İK/Yönetim'in oybirliği ve <strong>Mağazalar Direktörlüğü</strong>'nün onayına gider. Tam onay sonrası norm otomatik güncellenir.
      </div>

      {error && <div className="text-xs text-danger">{error}</div>}

      <button type="submit" disabled={pending || fark === 0} className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
        {pending ? "Gönderiliyor..." : "Talebi Gönder"}
      </button>
    </form>
  );
}
