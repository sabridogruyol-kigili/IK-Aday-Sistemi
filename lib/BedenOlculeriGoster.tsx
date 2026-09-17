"use client";

import { useState } from "react";
import { bedenOlculeriGetir, type BedenOlculeriSonucu } from "@/app/(app)/personel/actions-hassas";

// Beden ölçüleri de hassas veri sayılır (varsayılan sadece Yönetim, diğer
// roller Ayarlar > Bilgi Yetkileri'nden açılabilir) — TC/maaş ile aynı
// reveal + denetim kaydı mantığı.
export default function BedenOlculeriGoster({ personelId, gorebilir }: { personelId: string; gorebilir: boolean }) {
  const [sonuc, setSonuc] = useState<BedenOlculeriSonucu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function goster() {
    setYukleniyor(true);
    setHata(null);
    const r = await bedenOlculeriGetir(personelId);
    setYukleniyor(false);
    if (r.error) { setHata(r.error); return; }
    setSonuc(r.deger);
  }

  if (!gorebilir) {
    return (
      <div className="text-[11px] text-gray-300 bg-gray-50 rounded-md px-2.5 py-2">
        🔒 Bu bilgiyi görüntüleme yetkiniz yok.
      </div>
    );
  }

  if (hata) {
    return <div className="text-[11px] text-danger bg-danger-bg rounded-md px-2.5 py-2">{hata}</div>;
  }

  if (!sonuc) {
    return (
      <button
        onClick={goster}
        disabled={yukleniyor}
        className="text-[11px] font-medium bg-white border border-gray-300 text-navy-3 hover:bg-gray-50 rounded-md px-2.5 py-1.5 disabled:opacity-50"
      >
        {yukleniyor ? "Getiriliyor…" : "👁 Beden Ölçülerini Göster"}
      </button>
    );
  }

  const doluMu = sonuc.beden_ceket || sonuc.beden_pantolon || sonuc.beden_gomlek || sonuc.beden_tisort;

  return (
    <div className="bg-gray-50 rounded-md px-2.5 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[9px] text-gray-400 uppercase">Beden Ölçüleri</div>
        <button onClick={() => setSonuc(null)} title="Gizle" className="text-gray-400 hover:text-navy text-[10px]">🙈</button>
      </div>
      {!doluMu ? (
        <div className="text-[11px] text-gray-400">Henüz girilmemiş.</div>
      ) : (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><div className="text-[9px] text-gray-400">Ceket</div><div className="text-sm font-mono font-semibold text-navy-3">{sonuc.beden_ceket ?? "—"}</div></div>
          <div><div className="text-[9px] text-gray-400">Pantolon</div><div className="text-sm font-mono font-semibold text-navy-3">{sonuc.beden_pantolon ?? "—"}</div></div>
          <div><div className="text-[9px] text-gray-400">Gömlek</div><div className="text-sm font-mono font-semibold text-navy-3">{sonuc.beden_gomlek ?? "—"}</div></div>
          <div><div className="text-[9px] text-gray-400">Tişört</div><div className="text-sm font-mono font-semibold text-navy-3">{sonuc.beden_tisort ?? "—"}</div></div>
        </div>
      )}
    </div>
  );
}
