"use client";

import { useMemo, useState, useTransition } from "react";
import { createRotasyonTalebi } from "./actions-rotasyon";

type Personel = {
  id: string; ad_soyad: string; guncel_unvan: string | null;
  guncel_magaza_id: string; magaza_adi: string; bolge_adi: string; kadro_kategorisi: string | null;
};
type Magaza = { id: string; magaza_adi: string; magaza_kodu: string; bolge_id: string; bolge_adi: string };

export default function RotasyonForm({ personelListesi, magazalar }: { personelListesi: Personel[]; magazalar: Magaza[] }) {
  const [pending, startTransition] = useTransition();
  const [normUyari, setNormUyari] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [israrli, setIsrarli] = useState(false);

  const bolgeler = useMemo(() => Array.from(new Set(personelListesi.map((p) => p.bolge_adi))).sort(), [personelListesi]);
  const [personelBolgeFiltre, setPersonelBolgeFiltre] = useState("");
  const [personelArama, setPersonelArama] = useState("");
  const [secilenPersonelId, setSecilenPersonelId] = useState("");

  const [hedefBolgeFiltre, setHedefBolgeFiltre] = useState("");

  const filtrelenmisPersonel = useMemo(() => {
    return personelListesi.filter((p) => {
      if (personelBolgeFiltre && p.bolge_adi !== personelBolgeFiltre) return false;
      if (personelArama) {
        const q = personelArama.toLocaleLowerCase("tr-TR");
        if (!p.ad_soyad.toLocaleLowerCase("tr-TR").includes(q) && !(p.guncel_unvan ?? "").toLocaleLowerCase("tr-TR").includes(q)) return false;
      }
      return true;
    });
  }, [personelListesi, personelBolgeFiltre, personelArama]);

  const secilenPersonel = personelListesi.find((p) => p.id === secilenPersonelId);

  const hedefMagazalar = useMemo(() => {
    return magazalar.filter((m) => {
      if (secilenPersonel && m.id === secilenPersonel.guncel_magaza_id) return false; // kendi mağazası hariç
      if (hedefBolgeFiltre && m.bolge_adi !== hedefBolgeFiltre) return false;
      return true;
    });
  }, [magazalar, secilenPersonel, hedefBolgeFiltre]);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("israrli", String(israrli));
    formData.set("personel_id", secilenPersonelId);
    startTransition(async () => {
      const sonuc = await createRotasyonTalebi(formData);
      if (sonuc?.norm_uyari) setNormUyari(sonuc.norm_uyari);
      else if (sonuc?.error) setError(sonuc.error);
    });
  }

  return (
    <form action={handleSubmit} className="bg-white border border-gray-200 rounded-card p-4 max-w-xl space-y-4">
      <div>
        <div className="text-[10px] font-semibold text-navy-3 uppercase mb-1">Personel Filtrele</div>
        <div className="flex gap-2 mb-2">
          <select value={personelBolgeFiltre} onChange={(e) => setPersonelBolgeFiltre(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1">
            <option value="">Tüm Bölgeler</option>
            {bolgeler.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <input value={personelArama} onChange={(e) => setPersonelArama(e.target.value)}
            placeholder="İsim / unvan ara..." className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1" />
        </div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Rotasyon Yapılacak Personel *</label>
        <select value={secilenPersonelId} onChange={(e) => setSecilenPersonelId(e.target.value)} required
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {filtrelenmisPersonel.map((p) => (
            <option key={p.id} value={p.id}>{p.ad_soyad} — {p.guncel_unvan} — {p.magaza_adi} ({p.bolge_adi})</option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-[10px] font-semibold text-navy-3 uppercase mb-1">Hedef Mağaza Filtrele</div>
        <select value={hedefBolgeFiltre} onChange={(e) => setHedefBolgeFiltre(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-full mb-2">
          <option value="">Tüm Bölgeler</option>
          {Array.from(new Set(magazalar.map((m) => m.bolge_adi))).sort().map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Hedef Mağaza *</label>
        <select name="hedef_magaza_id" required disabled={!secilenPersonelId}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400">
          <option value="">{secilenPersonelId ? "Seçin" : "Önce personel seçin"}</option>
          {hedefMagazalar.map((m) => (
            <option key={m.id} value={m.id}>{m.magaza_adi} ({m.magaza_kodu}) — {m.bolge_adi}</option>
          ))}
        </select>
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
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Açıklama {israrli && "*"}</label>
        <textarea name="aciklama" rows={3} required={israrli} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>

      {error && <div className="text-xs text-danger">{error}</div>}

      <button type="submit" disabled={pending || !secilenPersonelId} className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
        {pending ? "Gönderiliyor..." : "Talebi Gönder"}
      </button>
    </form>
  );
}
