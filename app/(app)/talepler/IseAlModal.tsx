"use client";

import { useState } from "react";
import { karaListeSorgula, type KaraListeUyarisi } from "../kara-liste/actions";

export default function IseAlModal({ onClose, onConfirm, pending, hata }: {
  onClose: () => void; onConfirm: (tc: string, baslangic: string) => void; pending: boolean; hata?: string | null;
}) {
  const [tc, setTc] = useState("");
  const [baslangic, setBaslangic] = useState(() => new Date().toISOString().slice(0, 10));
  const [yerelHata, setYerelHata] = useState<string | null>(null);
  const [kontrolEdiliyor, setKontrolEdiliyor] = useState(false);
  const [karaListeKaydi, setKaraListeKaydi] = useState<KaraListeUyarisi | null>(null);
  const [uyariGorulduTc, setUyariGorulduTc] = useState<string | null>(null);

  function tcDegisti(v: string) {
    setTc(v.replace(/\D/g, "").slice(0, 11));
    // TC değişince önceki uyarı geçersiz olur, tekrar kontrol edilmeli.
    setKaraListeKaydi(null);
    setUyariGorulduTc(null);
  }

  async function gonder() {
    if (!/^\d{11}$/.test(tc)) {
      setYerelHata("TC Kimlik No 11 haneli olmalı.");
      return;
    }
    if (!baslangic) {
      setYerelHata("Başlangıç tarihi zorunlu.");
      return;
    }
    setYerelHata(null);

    // Bu TC için uyarı daha önce gösterilmediyse önce kara liste kontrolü yapılır.
    if (uyariGorulduTc !== tc) {
      setKontrolEdiliyor(true);
      const kayit = await karaListeSorgula(tc);
      setKontrolEdiliyor(false);
      setUyariGorulduTc(tc);
      if (kayit) {
        setKaraListeKaydi(kayit);
        return; // ilk tıklamada sadece uyarı gösterilir, işe alım yapılmaz
      }
    }

    onConfirm(tc, baslangic);
  }

  const gosterilecekHata = yerelHata ?? hata;
  const butonEtiket = kontrolEdiliyor
    ? "Kontrol ediliyor..."
    : karaListeKaydi
    ? "Yine de İşe Al"
    : pending
    ? "Kaydediliyor..."
    : "İşe Al";

  return (
    <div className="fixed inset-0 bg-navy-3/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-navy-3">İşe Alım Bilgileri</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">TC Kimlik No *</label>
            <input
              value={tc}
              onChange={(e) => tcDegisti(e.target.value)}
              inputMode="numeric"
              placeholder="11 haneli TC kimlik no"
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Başlangıç Tarihi *</label>
            <input
              type="date"
              value={baslangic}
              onChange={(e) => setBaslangic(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>

          {karaListeKaydi && (
            <div className="bg-danger-bg border border-danger/30 rounded-md p-3 text-xs text-danger space-y-1">
              <div className="font-semibold">
                ⚠ Bu TC kara listede{karaListeKaydi.durum === "ONAY_BEKLIYOR" ? " (onay bekliyor)" : ""}!
              </div>
              <div>{karaListeKaydi.aciklama}</div>
              <div className="text-[10px] text-danger/70">
                Ekleyen: {karaListeKaydi.ekleyen_rol} — {new Date(karaListeKaydi.created_at).toLocaleDateString("tr-TR")}
              </div>
            </div>
          )}

          {gosterilecekHata && (
            <div className="text-[11px] text-danger bg-danger-bg rounded-md px-2 py-1.5">{gosterilecekHata}</div>
          )}

          <button onClick={gonder} disabled={pending || kontrolEdiliyor}
            className={`w-full text-white rounded-md py-2 text-sm font-medium disabled:opacity-50 ${karaListeKaydi ? "bg-danger" : "bg-success"}`}>
            {butonEtiket}
          </button>
        </div>
      </div>
    </div>
  );
}
