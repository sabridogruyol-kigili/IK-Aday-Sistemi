"use client";

import { useState } from "react";
import { brutMaasGetir, type BrutMaasSonucu } from "@/app/(app)/personel/actions-hassas";

// Brüt maaş + kıdem tazminatı tahmini — ikisi birlikte gelir çünkü tazminat
// tahmini maaşı geriye dönük hesaplanabilir kılar, aynı yetkiye tabidir.
export default function BrutMaasGoster({ personelId, gorebilir }: { personelId: string; gorebilir: boolean }) {
  const [sonuc, setSonuc] = useState<BrutMaasSonucu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function goster() {
    setYukleniyor(true);
    setHata(null);
    const r = await brutMaasGetir(personelId);
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
        {yukleniyor ? "Getiriliyor…" : "👁 Brüt Maaş / Tazminatı Göster"}
      </button>
    );
  }

  if (sonuc.brut_maas == null) {
    return (
      <div className="text-[11px] text-gray-400 bg-gray-50 rounded-md px-2.5 py-2">
        {sonuc.brut_maas_hata
          ? <span className="text-danger">Sorgu hatası: {sonuc.brut_maas_hata}</span>
          : "Bu personelin ünvanı için maaş bilgisi girilmemiş — Ayarlar > Maaş Bilgileri'nden ekleyebilirsiniz."}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-md px-2.5 py-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-mono font-semibold text-navy-3">
          {sonuc.kidem_tazminati_tahmini != null
            ? `${sonuc.kidem_tazminati_tahmini.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
            : "—"}
        </div>
        <button onClick={() => setSonuc(null)} title="Gizle" className="text-gray-400 hover:text-navy text-[10px]">🙈</button>
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">
        Brüt maaş: {sonuc.brut_maas.toLocaleString("tr-TR")} TL
        {sonuc.kidem_tazminati_tavani != null && sonuc.brut_maas > sonuc.kidem_tazminati_tavani && (
          <> — tavan aşıldığı için {sonuc.kidem_tazminati_tavani.toLocaleString("tr-TR")} TL üzerinden hesaplandı</>
        )}
      </div>
    </div>
  );
}
