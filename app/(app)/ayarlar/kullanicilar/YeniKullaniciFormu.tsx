"use client";

import { useState, useTransition } from "react";
import { createKullanici } from "./actions";
import BolgeDropdown from "./BolgeDropdown";

type Bolge = { id: string; ad: string };

export default function YeniKullaniciFormu({ bolgeler }: { bolgeler: Bolge[] }) {
  const [rol, setRol] = useState("BM");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bolgeGerekli = rol === "BM" || rol === "IK";

  function ekle(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const sonuc = await createKullanici(formData);
      if (sonuc?.error) setError(sonuc.error);
      else (document.getElementById("yeni-kullanici-formu") as HTMLFormElement | null)?.reset();
    });
  }

  return (
    <div>
      <form id="yeni-kullanici-formu" action={ekle} className="grid grid-cols-12 gap-3 items-end">
        <div className="col-span-3">
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">E-posta *</label>
          <input name="email" type="email" required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div className="col-span-3">
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Ad Soyad *</label>
          <input name="ad_soyad" required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div className={bolgeGerekli ? "col-span-2" : "col-span-5"}>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Rol *</label>
          <select name="rol" required value={rol} onChange={(e) => setRol(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
            <option value="BM">BM</option>
            <option value="IK">İK</option>
            <option value="YONETIM">Yönetim</option>
            <option value="MAGAZALAR_DIREKTORLUGU">Mağazalar Direktörlüğü</option>
          </select>
        </div>
        {bolgeGerekli && (
          <div className="col-span-3">
            <BolgeDropdown bolgeler={bolgeler} />
          </div>
        )}
        <div className="col-span-1">
          <button type="submit" disabled={pending}
            className="w-full bg-navy hover:bg-navy-2 text-white rounded-md py-1.5 text-sm font-medium disabled:opacity-50 transition-colors">
            {pending ? "..." : "Ekle"}
          </button>
        </div>
      </form>
      {error && <div className="text-xs text-danger mt-2">{error}</div>}
    </div>
  );
}
