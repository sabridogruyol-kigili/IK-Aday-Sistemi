"use client";

import { useState } from "react";
import EvrakOnayDetay from "../evrak-onay/EvrakOnayDetay";

type Kisi = { id: string; ad_soyad: string; guncel_unvan: string | null; magaza_adi: string | null };

export default function BordroBekleyenListesi({ kisiler, benimRolum }: { kisiler: Kisi[]; benimRolum: string }) {
  const [secili, setSecili] = useState<Kisi | null>(null);

  return (
    <div className="space-y-2">
      {kisiler.map((k) => (
        <button key={k.id} onClick={() => setSecili(k)}
          className="w-full flex items-center justify-between bg-white border border-gray-200 hover:border-navy/30 rounded-card px-4 py-3 text-left transition-colors">
          <div>
            <div className="text-sm font-medium text-navy-3">{k.ad_soyad}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {k.guncel_unvan ?? "—"}{k.magaza_adi && <> · {k.magaza_adi}</>}
            </div>
          </div>
          <span className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-medium">Sisteme Giriş Bekliyor</span>
        </button>
      ))}
      {kisiler.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-card p-6 text-center text-gray-400 text-xs">
          Sisteme giriş bekleyen kimse yok.
        </div>
      )}

      {secili && (
        <EvrakOnayDetay personelId={secili.id} adSoyad={secili.ad_soyad} benimRolum={benimRolum} onClose={() => setSecili(null)} />
      )}
    </div>
  );
}
