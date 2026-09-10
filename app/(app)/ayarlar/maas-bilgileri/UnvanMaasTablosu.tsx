"use client";

import { useState } from "react";
import { guncelleUnvanMaasi } from "./actions";

type UnvanSatiri = { unvan: string; kategori: string; brut_maas: number | null };

function UnvanSatir({ s }: { s: UnvanSatiri }) {
  const [deger, setDeger] = useState(s.brut_maas != null ? String(s.brut_maas) : "");
  const [pending, setPending] = useState(false);
  const [durum, setDurum] = useState<"idle" | "ok" | "hata">("idle");

  function kaydet() {
    setPending(true);
    setDurum("idle");
    const fd = new FormData();
    fd.set("unvan", s.unvan);
    fd.set("brut_maas", deger);
    guncelleUnvanMaasi(fd).then((res) => {
      setPending(false);
      setDurum(res?.error ? "hata" : "ok");
    });
  }

  return (
    <tr className="border-t border-gray-50">
      <td className="px-2 py-1.5 text-navy-3 font-medium">{s.unvan}</td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1.5 justify-end">
          <input
            value={deger}
            onChange={(e) => { setDeger(e.target.value); setDurum("idle"); }}
            placeholder="Brüt maaş"
            className="border border-gray-300 rounded-md px-2 py-1 text-xs w-32 font-mono text-right"
          />
          <button onClick={kaydet} disabled={pending}
            className="text-[11px] bg-navy hover:bg-navy-2 text-white rounded-md px-2 py-1 disabled:opacity-50 transition-colors">
            {pending ? "..." : "Kaydet"}
          </button>
          {durum === "ok" && <span className="text-success text-xs">✓</span>}
          {durum === "hata" && <span className="text-danger text-xs">✗</span>}
        </div>
      </td>
    </tr>
  );
}

export default function UnvanMaasTablosu({ unvanlar }: { unvanlar: UnvanSatiri[] }) {
  const eksikSayisi = unvanlar.filter((u) => u.brut_maas == null).length;

  return (
    <div>
      {eksikSayisi > 0 && (
        <div className="text-[11px] text-accent bg-accent/10 rounded-md px-2.5 py-1.5 mb-3">
          {eksikSayisi} ünvanın maaşı henüz girilmemiş.
        </div>
      )}
      <div className="border border-gray-100 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase">
              <th className="text-left px-2 py-1.5">Ünvan (Ana Kadro)</th>
              <th className="text-right px-2 py-1.5">Brüt Maaş (prim/ek ücret hariç)</th>
            </tr>
          </thead>
          <tbody>
            {unvanlar.map((u) => <UnvanSatir key={u.unvan} s={u} />)}
            {unvanlar.length === 0 && (
              <tr><td colSpan={2} className="px-2 py-6 text-center text-gray-400">Tanımlı ünvan bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
