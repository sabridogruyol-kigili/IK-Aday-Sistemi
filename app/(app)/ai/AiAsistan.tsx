"use client";

import { useEffect, useRef, useState } from "react";
import { aiSoruSor, type SohbetMesaji } from "./actions";

export default function AiAsistan() {
  const [acik, setAcik] = useState(false);
  const [mesajlar, setMesajlar] = useState<SohbetMesaji[]>([]);
  const [girdi, setGirdi] = useState("");
  const [pending, setPending] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const listeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight, behavior: "smooth" });
  }, [mesajlar, pending]);

  function gonder() {
    const soru = girdi.trim();
    if (!soru || pending) return;
    setHata(null);
    setGirdi("");
    const yeniGecmis: SohbetMesaji[] = [...mesajlar, { rol: "user", icerik: soru }];
    setMesajlar(yeniGecmis);
    setPending(true);
    aiSoruSor(yeniGecmis).then((res) => {
      setPending(false);
      if (res.hata) { setHata(res.hata); return; }
      setMesajlar((m) => [...m, { rol: "assistant", icerik: res.cevap ?? "" }]);
    });
  }

  return (
    <>
      {/* Yuvarlak açma butonu — sağ kenarda, her sayfada sabit */}
      {!acik && (
        <button
          onClick={() => setAcik(true)}
          className="fixed right-4 bottom-4 z-40 w-12 h-12 rounded-full bg-navy hover:bg-navy-2 text-white shadow-lg flex items-center justify-center transition-colors"
          title="AI Asistan"
        >
          <span className="text-xl">💬</span>
        </button>
      )}

      {/* Sohbet paneli */}
      {acik && (
        <div className="fixed right-4 bottom-4 z-40 w-[340px] max-w-[90vw] h-[480px] max-h-[75vh] bg-white border border-gray-200 rounded-card shadow-xl flex flex-col overflow-hidden">
          <div className="bg-navy text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <div className="text-sm font-semibold">AI Asistan</div>
              <div className="text-[10px] text-white/60">Sistem verilerinize göre cevap verir</div>
            </div>
            <button onClick={() => setAcik(false)} className="text-white/70 hover:text-white text-lg leading-none">×</button>
          </div>

          <div ref={listeRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-[#FAFAF8]">
            {mesajlar.length === 0 && (
              <div className="text-[11px] text-gray-400 text-center py-6 leading-relaxed">
                Örnek: "En düşük performanslı 3 kişi kim?"<br />"Onayımı bekleyen talep var mı?"<br />"Hangi mağazada norm açığı var?"
              </div>
            )}
            {mesajlar.map((m, i) => (
              <div key={i} className={`flex ${m.rol === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                  m.rol === "user" ? "bg-navy text-white" : "bg-white border border-gray-200 text-navy-3"
                }`}>
                  {m.icerik}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] text-gray-400 flex items-center gap-2">
                  <span className="yukleniyor-donen" /> Düşünüyor...
                </div>
              </div>
            )}
            {hata && (
              <div className="bg-danger-bg text-danger text-[11px] rounded-md px-3 py-2">{hata}</div>
            )}
          </div>

          <div className="border-t border-gray-200 p-2.5 flex gap-1.5 shrink-0 bg-white">
            <input
              value={girdi}
              onChange={(e) => setGirdi(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); gonder(); } }}
              placeholder="Bir soru sorun..."
              disabled={pending}
              className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-[12.5px] outline-none focus:ring-1 focus:ring-navy disabled:opacity-50"
            />
            <button onClick={gonder} disabled={pending || !girdi.trim()}
              className="bg-navy hover:bg-navy-2 text-white rounded-md px-3 py-1.5 text-[12px] font-medium disabled:opacity-40 transition-colors">
              Gönder
            </button>
          </div>
        </div>
      )}
    </>
  );
}
