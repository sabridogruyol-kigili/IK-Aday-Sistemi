"use client";

import { useState } from "react";
import { turnoverHesaplaVeGuncelle } from "./actions-turnover-hesapla";

export default function TurnoverHesaplaButonu() {
  const [pending, setPending] = useState(false);
  const [sonuc, setSonuc] = useState<{ hata?: string; guncellenenMagazaSayisi?: number; siniflandirilamayanAciklamalar?: string[] } | null>(null);

  function hesapla() {
    setPending(true);
    setSonuc(null);
    turnoverHesaplaVeGuncelle().then((res) => {
      setPending(false);
      setSonuc(res);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4">
      <div className="text-sm font-semibold text-navy-3 mb-1">Turnover Hesapla</div>
      <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        Turnover artık ayrı bir Excel şablonuyla yüklenmiyor — Personel şablonundaki "İşten Ayrılma Açıklaması"
        (SGK) bilgisinden, her mağaza için otomatik hesaplanıyor. Formül: (İlgili kategoride ayrılan sayısı /
        Ortalama Personel) × 100 — Ortalama Personel = (Yıl başı + Şu anki) / 2. Personel şablonunu her
        güncelledikten sonra bu butona basarak turnover'ı yeniden hesaplatabilirsiniz.
      </div>

      <button onClick={hesapla} disabled={pending}
        className="bg-navy hover:bg-navy-2 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
        {pending ? "Hesaplanıyor..." : "Turnover'ı Yeniden Hesapla"}
      </button>

      {sonuc && (
        <div className="mt-3">
          {sonuc.hata ? (
            <div className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">{sonuc.hata}</div>
          ) : (
            <div className="text-xs text-success bg-success-bg rounded-md px-3 py-2">
              ✓ {sonuc.guncellenenMagazaSayisi} mağazanın turnover değeri güncellendi.
            </div>
          )}
          {sonuc.siniflandirilamayanAciklamalar && sonuc.siniflandirilamayanAciklamalar.length > 0 && (
            <div className="text-[11px] text-accent bg-accent/10 rounded-md px-3 py-2 mt-2">
              <div className="font-medium mb-1">Sınıflandırılamayan (istifa/fesih dışı, hesaba dahil edilmeyen) açıklamalar bulundu:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {sonuc.siniflandirilamayanAciklamalar.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
              <div className="mt-1 text-gray-500">Bunları istifa/fesih olarak sınıflandırmamı isterseniz bana bildirin.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
