"use client";

import { useState, useTransition } from "react";
import { kararVer } from "./actions";

export default function OnayKarti({
  onayId, talepNo, magaza, pozisyon, kisiSayisi, acanRol, aciklama, normSonuc,
}: {
  onayId: string; talepNo: string; magaza?: string; pozisyon?: string;
  kisiSayisi?: number; acanRol?: string; aciklama?: string | null; normSonuc?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [redMod, setRedMod] = useState(false);
  const [redAciklama, setRedAciklama] = useState("");
  const [error, setError] = useState<string | null>(null);

  function gonder(karar: "ONAY" | "RED") {
    setError(null);
    const fd = new FormData();
    fd.set("onay_id", onayId);
    fd.set("karar", karar);
    fd.set("aciklama", redAciklama);
    startTransition(async () => {
      const res = await kararVer(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-mono text-sm text-navy-3">{talepNo}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {magaza} — {pozisyon} — {kisiSayisi} kişi — Açan: {acanRol}
          </div>
        </div>
        {normSonuc === "UYGUN_DEGIL_ISRARLI" && (
          <span className="text-[10px] bg-danger-bg text-danger px-2 py-0.5 rounded-full font-medium">
            Norm Aşımı — Israrlı
          </span>
        )}
      </div>
      {aciklama && <div className="text-xs text-gray-600 mb-3">"{aciklama}"</div>}

      {!redMod ? (
        <div className="flex gap-2">
          <button onClick={() => gonder("ONAY")} disabled={pending}
            className="bg-success text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
            Onayla
          </button>
          <button onClick={() => setRedMod(true)} disabled={pending}
            className="bg-danger-bg text-danger border border-danger/30 rounded-md px-3 py-1.5 text-xs font-medium">
            Reddet
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={redAciklama}
            onChange={(e) => setRedAciklama(e.target.value)}
            placeholder="Red gerekçesi (zorunlu)"
            rows={2}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
          />
          <div className="flex gap-2">
            <button onClick={() => gonder("RED")} disabled={pending || !redAciklama.trim()}
              className="bg-danger text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
              Reddi Onayla
            </button>
            <button onClick={() => setRedMod(false)} className="text-xs text-gray-400">Vazgeç</button>
          </div>
        </div>
      )}
      {error && <div className="text-xs text-danger mt-2">{error}</div>}
    </div>
  );
}
