"use client";

import { useState } from "react";
import { kullaniciBedenOlculeriGetir } from "./actions";

export default function KullaniciBedenGoster({ kullaniciId }: { kullaniciId: string }) {
  const [deger, setDeger] = useState<{ beden_ceket: string | null; beden_pantolon: string | null; beden_gomlek: string | null; beden_tisort: string | null } | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function goster() {
    setYukleniyor(true);
    setHata(null);
    const sonuc = await kullaniciBedenOlculeriGetir(kullaniciId);
    setYukleniyor(false);
    if (sonuc.error) { setHata(sonuc.error); return; }
    setDeger(sonuc.deger);
  }

  if (hata) return <span className="text-danger text-[10px]">{hata}</span>;

  if (!deger) {
    return (
      <button onClick={goster} disabled={yukleniyor} className="text-[10px] text-info hover:underline disabled:opacity-50">
        {yukleniyor ? "…" : "👁 Göster"}
      </button>
    );
  }

  const bosMu = !deger.beden_ceket && !deger.beden_pantolon && !deger.beden_gomlek && !deger.beden_tisort;

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono">
      {bosMu ? <span className="text-gray-300">Girilmemiş</span> : (
        <>C:{deger.beden_ceket ?? "—"} P:{deger.beden_pantolon ?? "—"} G:{deger.beden_gomlek ?? "—"} T:{deger.beden_tisort ?? "—"}</>
      )}
      <button onClick={() => setDeger(null)} title="Gizle" className="text-gray-400 hover:text-navy text-[10px]">🙈</button>
    </span>
  );
}
