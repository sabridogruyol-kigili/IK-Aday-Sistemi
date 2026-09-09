"use client";

import { useState, useTransition } from "react";
import { guncelleKidemTavani } from "./actions";

export default function TavanFormu({ mevcutTavan }: { mevcutTavan: number }) {
  const [tavan, setTavan] = useState(String(mevcutTavan));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);

  function kaydet() {
    setError(null);
    setKaydedildi(false);
    const fd = new FormData();
    fd.set("tavan", tavan);
    startTransition(async () => {
      const res = await guncelleKidemTavani(fd);
      if (res?.error) { setError(res.error); return; }
      setKaydedildi(true);
    });
  }

  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Yıllık Tavan (TL, brüt)</label>
        <input
          value={tavan}
          onChange={(e) => setTavan(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-40 font-mono"
        />
      </div>
      <button onClick={kaydet} disabled={pending}
        className="bg-navy hover:bg-navy-2 text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 transition-colors">
        {pending ? "Kaydediliyor..." : "Kaydet"}
      </button>
      {kaydedildi && <span className="text-xs text-success">Kaydedildi.</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
