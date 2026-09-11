"use client";

import { useState } from "react";
import { emailDogrula, koduDogrula, getPortalVerisi, type PortalVerisi } from "./actions";
import EvrakPortaliClient from "./EvrakPortaliClient";
import PortalBaslik from "./PortalBaslik";

export default function EvrakGirisAkisi({ token }: { token: string }) {
  const [adim, setAdim] = useState<"email" | "kod" | "portal">("email");
  const [email, setEmail] = useState("");
  const [kod, setKod] = useState("");
  const [pending, setPending] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [veri, setVeri] = useState<PortalVerisi | null>(null);

  function emailGonder() {
    setHata(null);
    setPending(true);
    emailDogrula(token, email).then((res) => {
      setPending(false);
      if (res?.error) { setHata(res.error); return; }
      setAdim("kod");
    });
  }

  function koduOnayla() {
    setHata(null);
    setPending(true);
    koduDogrula(token, kod).then((res) => {
      if (res?.error) { setPending(false); setHata(res.error); return; }
      getPortalVerisi(token, kod).then((v) => {
        setPending(false);
        if ("error" in v) { setHata(v.error); return; }
        setVeri(v);
        setAdim("portal");
      });
    });
  }

  if (adim === "portal" && veri) {
    return <EvrakPortaliClient token={token} kod={kod} veri={veri} />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <PortalBaslik />
        <div className="bg-white border border-gray-200 rounded-card p-6">
        <div className="text-sm font-semibold text-navy-3 mb-1">
          {adim === "email" ? "Evrak Portalına Hoş Geldiniz" : "E-postanızı Doğrulayın"}
        </div>

        {adim === "email" && (
          <>
            <div className="text-xs text-gray-500 mb-5 leading-relaxed">
              Devam etmek için işe alım sürecinizde kayıtlı e-posta adresinizi girin — size bir doğrulama kodu göndereceğiz.
            </div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1.5">E-posta Adresiniz</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm mb-3"
            />
            {hata && <div className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2 mb-3">{hata}</div>}
            <button onClick={emailGonder} disabled={pending || !email}
              className="w-full bg-navy hover:bg-navy-2 text-white rounded-md py-2.5 text-sm font-medium disabled:opacity-40 transition-colors">
              {pending ? "Gönderiliyor..." : "Doğrulama Kodu Gönder"}
            </button>
          </>
        )}

        {adim === "kod" && (
          <>
            <div className="text-xs text-gray-500 mb-5 leading-relaxed">
              <strong className="text-navy-3">{email}</strong> adresine 6 haneli bir kod gönderdik. Aşağıya girip devam edin.
            </div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1.5">Doğrulama Kodu</label>
            <input
              value={kod}
              onChange={(e) => setKod(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="------"
              inputMode="numeric"
              className="w-full border border-gray-300 rounded-md px-3 py-3 text-sm mb-3 text-center font-mono text-xl tracking-[0.4em]"
            />
            {hata && <div className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2 mb-3">{hata}</div>}
            <button onClick={koduOnayla} disabled={pending || kod.length !== 6}
              className="w-full bg-navy hover:bg-navy-2 text-white rounded-md py-2.5 text-sm font-medium disabled:opacity-40 transition-colors">
              {pending ? "Doğrulanıyor..." : "Devam Et"}
            </button>
            <button onClick={() => { setAdim("email"); setKod(""); setHata(null); }} className="w-full text-center text-[11px] text-gray-400 mt-3 hover:text-gray-600">
              Farklı bir e-posta dene
            </button>

          </>
        )}
        </div>
      </div>
    </div>
  );
}
