"use client";

import { useState } from "react";
import { guncelleIkIletisim } from "./actions";

export default function IkIletisimFormu({
  mevcutWebsite, mevcutEmail, mevcutAdres, mevcutCalismaSaatleri,
}: { mevcutWebsite: string; mevcutEmail: string; mevcutAdres: string; mevcutCalismaSaatleri: string }) {
  // Zaten kayıtlı bilgi varsa (en az e-posta), sayfaya girer girmez salt-okunur
  // özet gösterilir — form her açılışta boş/silinmiş gibi görünmesin diye.
  // Değiştirmek isteyen "Düzenle"ye basıp forma geçer.
  const [duzenlemeModu, setDuzenlemeModu] = useState(!mevcutEmail);

  const [website, setWebsite] = useState(mevcutWebsite);
  const [email, setEmail] = useState(mevcutEmail);
  const [adres, setAdres] = useState(mevcutAdres);
  const [calismaSaatleri, setCalismaSaatleri] = useState(mevcutCalismaSaatleri);

  const [kayitliWebsite, setKayitliWebsite] = useState(mevcutWebsite);
  const [kayitliEmail, setKayitliEmail] = useState(mevcutEmail);
  const [kayitliAdres, setKayitliAdres] = useState(mevcutAdres);
  const [kayitliCalismaSaatleri, setKayitliCalismaSaatleri] = useState(mevcutCalismaSaatleri);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function kaydet() {
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("ik_website", website);
    fd.set("ik_email", email);
    fd.set("ik_adres", adres);
    fd.set("ik_calisma_saatleri", calismaSaatleri);
    guncelleIkIletisim(fd).then((res) => {
      setPending(false);
      if (res?.error) { setError(res.error); return; }
      setKayitliWebsite(website);
      setKayitliEmail(email);
      setKayitliAdres(adres);
      setKayitliCalismaSaatleri(calismaSaatleri);
      setDuzenlemeModu(false);
    });
  }

  function duzenlemeyeGec() {
    // Forma geçerken en son kayıtlı değerlerle başlasın (yarım kalmış eski
    // taslak değil).
    setWebsite(kayitliWebsite);
    setEmail(kayitliEmail);
    setAdres(kayitliAdres);
    setCalismaSaatleri(kayitliCalismaSaatleri);
    setError(null);
    setDuzenlemeModu(true);
  }

  if (!duzenlemeModu) {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mb-3 text-sm">
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Web Sitesi</div>
            <div className="text-navy-3">{kayitliWebsite || "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase">E-posta</div>
            <div className="text-navy-3">{kayitliEmail || "—"}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-[10px] text-gray-400 uppercase">Adres</div>
            <div className="text-navy-3">{kayitliAdres || "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Çalışma Saatleri</div>
            <div className="text-navy-3">{kayitliCalismaSaatleri || "—"}</div>
          </div>
        </div>
        <button onClick={duzenlemeyeGec}
          className="bg-white border border-gray-300 hover:bg-gray-50 text-navy-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors">
          Düzenle
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Web Sitesi</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)}
            placeholder="www.sirket.com" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">E-posta</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="ik@sirket.com" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Adres</label>
        <textarea value={adres} onChange={(e) => setAdres(e.target.value)}
          placeholder="Örn: Merkez Mah. Örnek Cad. No: 1 Kat: 3, Şişli / İstanbul"
          rows={2} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm resize-none" />
      </div>

      <div className="mb-3">
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Çalışma Saatleri</label>
        <input value={calismaSaatleri} onChange={(e) => setCalismaSaatleri(e.target.value)}
          placeholder="Hafta içi 09.00–18.00" className="w-full sm:w-72 border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>

      {error && <div className="text-xs text-danger mb-2">{error}</div>}

      <div className="flex items-center gap-2">
        <button onClick={kaydet} disabled={pending}
          className="bg-navy hover:bg-navy-2 text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 transition-colors">
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
        {kayitliEmail && (
          <button onClick={() => setDuzenlemeModu(false)} className="text-xs text-gray-400 hover:text-gray-600">
            Vazgeç
          </button>
        )}
      </div>
    </div>
  );
}
