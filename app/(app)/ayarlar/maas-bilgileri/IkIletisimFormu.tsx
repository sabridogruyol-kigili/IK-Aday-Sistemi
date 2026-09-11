"use client";

import { useState } from "react";
import { guncelleIkIletisim } from "./actions";

export default function IkIletisimFormu({
  mevcutTelefon, mevcutEmail, mevcutCalismaSaatleri,
}: { mevcutTelefon: string; mevcutEmail: string; mevcutCalismaSaatleri: string }) {
  const [telefon, setTelefon] = useState(mevcutTelefon);
  const [email, setEmail] = useState(mevcutEmail);
  const [calismaSaatleri, setCalismaSaatleri] = useState(mevcutCalismaSaatleri);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);

  function kaydet() {
    setError(null);
    setKaydedildi(false);
    setPending(true);
    const fd = new FormData();
    fd.set("ik_telefon", telefon);
    fd.set("ik_email", email);
    fd.set("ik_calisma_saatleri", calismaSaatleri);
    guncelleIkIletisim(fd).then((res) => {
      setPending(false);
      if (res?.error) { setError(res.error); return; }
      setKaydedildi(true);
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Telefon</label>
          <input value={telefon} onChange={(e) => { setTelefon(e.target.value); setKaydedildi(false); }}
            placeholder="0212 000 00 00" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">E-posta</label>
          <input value={email} onChange={(e) => { setEmail(e.target.value); setKaydedildi(false); }}
            placeholder="ik@sirket.com" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Çalışma Saatleri</label>
          <input value={calismaSaatleri} onChange={(e) => { setCalismaSaatleri(e.target.value); setKaydedildi(false); }}
            placeholder="Hafta içi 09.00–18.00" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={kaydet} disabled={pending}
          className="bg-navy hover:bg-navy-2 text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 transition-colors">
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
        {kaydedildi && <span className="text-xs text-success">Kaydedildi.</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
