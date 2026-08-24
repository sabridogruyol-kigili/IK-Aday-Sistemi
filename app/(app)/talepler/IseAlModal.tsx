"use client";

import { useState } from "react";

export default function IseAlModal({ onClose, onConfirm, pending, hata }: {
  onClose: () => void; onConfirm: (tc: string, baslangic: string) => void; pending: boolean; hata?: string | null;
}) {
  const [tc, setTc] = useState("");
  const [baslangic, setBaslangic] = useState(() => new Date().toISOString().slice(0, 10));
  const [yerelHata, setYerelHata] = useState<string | null>(null);

  function gonder() {
    if (!/^\d{11}$/.test(tc)) {
      setYerelHata("TC Kimlik No 11 haneli olmalı.");
      return;
    }
    if (!baslangic) {
      setYerelHata("Başlangıç tarihi zorunlu.");
      return;
    }
    setYerelHata(null);
    onConfirm(tc, baslangic);
  }

  const gosterilecekHata = yerelHata ?? hata;

  return (
    <div className="fixed inset-0 bg-navy-3/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-navy-3">İşe Alım Bilgileri</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">TC Kimlik No *</label>
            <input
              value={tc}
              onChange={(e) => setTc(e.target.value.replace(/\D/g, "").slice(0, 11))}
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

          {gosterilecekHata && (
            <div className="text-[11px] text-danger bg-danger-bg rounded-md px-2 py-1.5">{gosterilecekHata}</div>
          )}

          <button onClick={gonder} disabled={pending}
            className="w-full bg-success text-white rounded-md py-2 text-sm font-medium disabled:opacity-50">
            {pending ? "Kaydediliyor..." : "İşe Al"}
          </button>
        </div>
      </div>
    </div>
  );
}
