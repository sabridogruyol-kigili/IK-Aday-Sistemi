"use client";

import { useState } from "react";
import { simulasyonIseAl } from "./actions";

type Magaza = { id: string; magaza_adi: string };

export default function SimulasyonFormu({ magazalar }: { magazalar: Magaza[] }) {
  const [magazaId, setMagazaId] = useState("");
  const [unvan, setUnvan] = useState("");
  const [adSoyad, setAdSoyad] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sonuc, setSonuc] = useState<{ hata?: string; basariliEmail?: string } | null>(null);

  const gecerliMi = magazaId && unvan.trim() && adSoyad.trim() && email.trim();

  function gonder() {
    const gonderilenEmail = email.trim();
    setPending(true);
    setSonuc(null);
    simulasyonIseAl({ magazaId, unvan, adSoyad, email }).then((res) => {
      setPending(false);
      if (res.error) { setSonuc({ hata: res.error }); return; }
      setSonuc({ basariliEmail: gonderilenEmail });
      setAdSoyad("");
      setEmail("");
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4 max-w-lg">
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Şube</label>
          <select value={magazaId} onChange={(e) => setMagazaId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm bg-white">
            <option value="">Seçin</option>
            {magazalar.map((m) => <option key={m.id} value={m.id}>{m.magaza_adi}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Ünvan</label>
          <input value={unvan} onChange={(e) => setUnvan(e.target.value)} placeholder="Örn. Satış Danışmanı"
            className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Aday Adı Soyadı</label>
          <input value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} placeholder="Örn. Ahmet Demir"
            className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">E-posta</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@sirket.com"
            className="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm" />
        </div>

        <button onClick={gonder} disabled={pending || !gecerliMi}
          className="w-full bg-navy hover:bg-navy-2 text-white rounded-md py-2.5 text-sm font-medium disabled:opacity-40 transition-colors">
          {pending ? "İşleniyor..." : "İşe Al"}
        </button>

        {sonuc?.hata && <div className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">{sonuc.hata}</div>}
        {sonuc?.basariliEmail && (
          <div className="text-xs text-success bg-success-bg rounded-md px-3 py-2">
            ✓ Süreç tamamlandı — {sonuc.basariliEmail} adresine "İşe Alımınız Onaylandı" maili gönderildi. Evrak portalı bağlantısı mailin içinde.
          </div>
        )}
      </div>
    </div>
  );
}
