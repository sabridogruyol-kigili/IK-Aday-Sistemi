"use client";

import { useMemo, useState, useTransition } from "react";
import { createIstenCikarmaTalebi } from "./actions-cikarma";

type Pozisyon = { unvan: string; kategori: string };
type Personel = {
  id: string;
  ad_soyad: string;
  guncel_unvan: string | null;
  magaza_adi: string;
  bolge_adi: string;
  performans_ortalama_hgo: number | null;
  performans_80_alti_sayisi: number | null;
  performans_80_100_arasi_sayisi: number | null;
  performans_100_ustu_sayisi: number | null;
};

const KATEGORI_LABEL: Record<string, string> = {
  ANA_KADRO: "Ana Kadro",
  DONEMSEL: "Dönemsel",
  PART_TIME: "Part Time",
};

export default function CikarmaForm({
  personelListesi,
  pozisyonlar,
}: {
  personelListesi: Personel[];
  pozisyonlar: Pozisyon[];
}) {
  const [pending, startTransition] = useTransition();
  const [normUyari, setNormUyari] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [israrli, setIsrarli] = useState(false);
  const [yerineAlim, setYerineAlim] = useState(false);
  const [seciliPersonelId, setSeciliPersonelId] = useState("");
  const [aciklama, setAciklama] = useState("");

  const seciliPersonel = personelListesi.find((p) => p.id === seciliPersonelId) ?? null;
  const hgoDusuk = seciliPersonel != null && seciliPersonel.performans_ortalama_hgo != null && seciliPersonel.performans_ortalama_hgo < 80;
  const aciklamaZorunlu = israrli || hgoDusuk;

  const bolgeler = useMemo(() => Array.from(new Set(personelListesi.map((p) => p.bolge_adi).filter(Boolean))).sort(), [personelListesi]);
  const [bolgeFiltre, setBolgeFiltre] = useState("");
  const [arama, setArama] = useState("");

  const filtrelenmisPersonel = useMemo(() => {
    return personelListesi.filter((p) => {
      if (bolgeFiltre && p.bolge_adi !== bolgeFiltre) return false;
      if (arama) {
        const q = arama.toLocaleLowerCase("tr-TR");
        if (!p.ad_soyad.toLocaleLowerCase("tr-TR").includes(q) && !(p.guncel_unvan ?? "").toLocaleLowerCase("tr-TR").includes(q)) return false;
      }
      return true;
    });
  }, [personelListesi, bolgeFiltre, arama]);

  const gruplar = Array.from(new Set(pozisyonlar.map((p) => p.kategori)));

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("yerine_alim", String(yerineAlim));
    formData.set("israrli", String(israrli));
    startTransition(async () => {
      const sonuc = await createIstenCikarmaTalebi(formData);
      if (sonuc?.norm_uyari) setNormUyari(sonuc.norm_uyari);
      else if (sonuc?.error) setError(sonuc.error);
    });
  }

  return (
    <form action={handleSubmit} className="bg-white border border-gray-200 rounded-card p-4 max-w-xl space-y-4">
      <div>
        <div className="text-[10px] font-semibold text-navy-3 uppercase mb-1">Filtrele</div>
        <div className="flex gap-2 mb-2">
          <select value={bolgeFiltre} onChange={(e) => setBolgeFiltre(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1">
            <option value="">Tüm Bölgeler (yetkiniz dahilinde)</option>
            {bolgeler.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <input value={arama} onChange={(e) => setArama(e.target.value)}
            placeholder="İsim / unvan ara..." className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1" />
        </div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Çıkarılacak Personel *</label>
        <select name="personel_id" required value={seciliPersonelId}
          onChange={(e) => setSeciliPersonelId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {filtrelenmisPersonel.map((p) => (
            <option key={p.id} value={p.id}>{p.ad_soyad} — {p.guncel_unvan} — {p.magaza_adi} ({p.bolge_adi})</option>
          ))}
        </select>
      </div>

      {seciliPersonel && (
        <div className={`rounded-md p-3 text-xs space-y-1 ${hgoDusuk ? "bg-danger-bg border border-danger/30" : "bg-gray-50 border border-gray-200"}`}>
          <div className="font-semibold text-navy-3 mb-1">Performans Özeti — {seciliPersonel.ad_soyad}</div>
          {seciliPersonel.performans_ortalama_hgo == null ? (
            <div className="text-gray-400">Bu personel için henüz performans verisi içe aktarılmamış.</div>
          ) : (
            <>
              <div className={hgoDusuk ? "text-danger font-semibold" : "text-gray-700"}>
                Ortalama HGO: %{seciliPersonel.performans_ortalama_hgo.toFixed(1)}
                {hgoDusuk && " — %80 altı, açıklama zorunlu"}
              </div>
              <div className="text-gray-500">
                %80 altı: {seciliPersonel.performans_80_alti_sayisi ?? 0} ay ·
                {" "}%80–100: {seciliPersonel.performans_80_100_arasi_sayisi ?? 0} ay ·
                {" "}%100 üstü: {seciliPersonel.performans_100_ustu_sayisi ?? 0} ay
              </div>
            </>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={yerineAlim} onChange={(e) => setYerineAlim(e.target.checked)} />
        Yerine alım yapılacak
      </label>

      {yerineAlim && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Yeni Pozisyon Tipi *</label>
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
        </>
      )}

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
          Açıklama {aciklamaZorunlu && "*"}
        </label>
        <textarea name="aciklama" value={aciklama} onChange={(e) => setAciklama(e.target.value)}
          rows={3} required={aciklamaZorunlu} minLength={aciklamaZorunlu ? 100 : undefined}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        {aciklamaZorunlu && (
          <div className={`text-[10px] mt-1 ${aciklama.trim().length >= 100 ? "text-success" : "text-gray-400"}`}>
            {aciklama.trim().length} / 100 karakter
          </div>
        )}
      </div>

      {error && <div className="text-xs text-danger">{error}</div>}

      <button type="submit" disabled={pending || (aciklamaZorunlu && aciklama.trim().length < 100)} className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
        {pending ? "Gönderiliyor..." : "Talebi Gönder"}
      </button>
    </form>
  );
}
