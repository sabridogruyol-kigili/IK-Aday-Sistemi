"use client";

import { useState, useTransition } from "react";
import { guncelleKullanici } from "./actions";
import BolgeDropdown from "./BolgeDropdown";

type Bolge = { id: string; ad: string };

export default function KullaniciDuzenle({
  kullaniciId, mevcutRol, mevcutBolgeIdler, bolgeler,
}: {
  kullaniciId: string; mevcutRol: string; mevcutBolgeIdler: string[]; bolgeler: Bolge[];
}) {
  const [acik, setAcik] = useState(false);
  const [pending, startTransition] = useTransition();

  function kaydet(formData: FormData) {
    formData.set("id", kullaniciId);
    startTransition(async () => {
      await guncelleKullanici(formData);
      setAcik(false);
    });
  }

  if (!acik) {
    return (
      <button onClick={() => setAcik(true)} className="text-xs text-info hover:underline">
        Düzenle
      </button>
    );
  }

  return (
    <form action={kaydet} className="bg-gray-50 border border-gray-200 rounded-md p-2.5 space-y-2 w-56">
      <div>
        <label className="block text-[9px] font-semibold text-navy-3 uppercase mb-0.5">Rol</label>
        <select name="rol" defaultValue={mevcutRol} className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs bg-white">
          <option value="BM">BM</option>
          <option value="IK">İK</option>
          <option value="YONETIM">Yönetim</option>
          <option value="MAGAZALAR_DIREKTORLUGU">Mağazalar Direktörlüğü</option>
        </select>
      </div>
      <BolgeDropdown bolgeler={bolgeler} baslangicSecili={mevcutBolgeIdler} />
      <div className="flex gap-1.5">
        <button type="submit" disabled={pending}
          className="bg-navy hover:bg-navy-2 text-white rounded-md px-2 py-1 text-[11px] font-medium disabled:opacity-50 transition-colors">
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button type="button" onClick={() => setAcik(false)} className="text-[11px] text-gray-400">
          Vazgeç
        </button>
      </div>
    </form>
  );
}
