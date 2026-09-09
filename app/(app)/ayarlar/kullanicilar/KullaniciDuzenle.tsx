"use client";

import { useState, useTransition } from "react";
import { guncelleKullanici } from "./actions";
import BolgeDropdown from "./BolgeDropdown";

type Bolge = { id: string; ad: string };

export default function KullaniciDuzenle({
  kullaniciId, mevcutAdSoyad, mevcutEmail, mevcutRol, mevcutAktif, mevcutBolgeIdler, bolgeler,
}: {
  kullaniciId: string; mevcutAdSoyad: string; mevcutEmail: string; mevcutRol: string;
  mevcutAktif: boolean; mevcutBolgeIdler: string[]; bolgeler: Bolge[];
}) {
  const [acik, setAcik] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function kaydet(formData: FormData) {
    setError(null);
    formData.set("id", kullaniciId);
    startTransition(async () => {
      const sonuc = await guncelleKullanici(formData);
      if (sonuc?.error) { setError(sonuc.error); return; }
      setAcik(false);
    });
  }

  return (
    <>
      <button onClick={() => setAcik(true)} className="text-xs text-info hover:underline">
        Düzenle
      </button>

      {acik && (
        <div className="fixed inset-0 bg-navy-3/60 z-50 flex items-center justify-center p-4" onClick={() => setAcik(false)}>
          <div className="bg-white rounded-card border border-gray-200 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="text-sm font-semibold text-navy-3">Kullanıcıyı Düzenle</div>
              <button onClick={() => setAcik(false)} className="text-gray-400 text-lg leading-none">×</button>
            </div>

            <form action={kaydet} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Ad Soyad *</label>
                <input name="ad_soyad" required defaultValue={mevcutAdSoyad}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">E-posta *</label>
                <input name="email" type="email" required defaultValue={mevcutEmail}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Rol *</label>
                <select name="rol" defaultValue={mevcutRol} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white">
                  <option value="BM">BM</option>
                  <option value="IK">İK</option>
                  <option value="YONETIM">Yönetim</option>
                  <option value="MAGAZALAR_DIREKTORLUGU">Mağazalar Direktörlüğü</option>
                </select>
              </div>
              <BolgeDropdown bolgeler={bolgeler} baslangicSecili={mevcutBolgeIdler} />
              <div>
                <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Durum</label>
                <select name="aktif" defaultValue={String(mevcutAktif)} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white">
                  <option value="true">Aktif</option>
                  <option value="false">Pasif</option>
                </select>
              </div>

              <div className="text-[10px] text-gray-400 bg-gray-50 rounded-md p-2">
                Bu kaydı güncellediğinizde, kullanıcının mevcut oturumu sonlandırılır — bir sonraki adımda otomatik çıkışa uğrar ve tekrar giriş yapması gerekir.
              </div>

              {error && <div className="text-xs text-danger">{error}</div>}

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pending}
                  className="bg-navy hover:bg-navy-2 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
                  {pending ? (<span className="flex items-center justify-center gap-2"><span className="yukleniyor-donen" /> Kaydediliyor</span>) : "Kaydet"}
                </button>
                <button type="button" onClick={() => setAcik(false)} className="text-sm text-gray-400">Vazgeç</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
