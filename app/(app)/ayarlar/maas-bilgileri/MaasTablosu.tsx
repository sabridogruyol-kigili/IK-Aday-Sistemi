"use client";

import { useMemo, useState } from "react";
import { guncelleMaas } from "./actions";

type Personel = {
  id: string; ad_soyad: string; guncel_unvan: string | null; magaza_adi: string;
  kidem_ay: number | null; brut_maas: number | null;
};

function MaasSatiri({ p }: { p: Personel }) {
  const [deger, setDeger] = useState(p.brut_maas != null ? String(p.brut_maas) : "");
  const [pending, setPending] = useState(false);
  const [durum, setDurum] = useState<"idle" | "ok" | "hata">("idle");

  function kaydet() {
    setPending(true);
    setDurum("idle");
    const fd = new FormData();
    fd.set("personel_id", p.id);
    fd.set("brut_maas", deger);
    guncelleMaas(fd).then((res) => {
      setPending(false);
      setDurum(res?.error ? "hata" : "ok");
    });
  }

  return (
    <tr className="border-t border-gray-50">
      <td className="px-2 py-1.5 text-navy-3 font-medium">{p.ad_soyad}</td>
      <td className="px-2 py-1.5 text-gray-500">{p.guncel_unvan ?? "—"}</td>
      <td className="px-2 py-1.5 text-gray-500">{p.magaza_adi}</td>
      <td className="px-2 py-1.5 text-right font-mono text-gray-500">
        {p.kidem_ay != null ? `${Math.floor(p.kidem_ay / 12)}y ${p.kidem_ay % 12}a` : "—"}
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1.5 justify-end">
          <input
            value={deger}
            onChange={(e) => { setDeger(e.target.value); setDurum("idle"); }}
            placeholder="Brüt maaş"
            className="border border-gray-300 rounded-md px-2 py-1 text-xs w-28 font-mono text-right"
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

export default function MaasTablosu({ personel }: { personel: Personel[] }) {
  const [arama, setArama] = useState("");
  const [sadeceEksik, setSadeceEksik] = useState(false);

  const filtrelenmis = useMemo(() => {
    return personel.filter((p) => {
      if (sadeceEksik && p.brut_maas != null) return false;
      if (arama) {
        const q = arama.toLocaleLowerCase("tr-TR");
        if (!p.ad_soyad.toLocaleLowerCase("tr-TR").includes(q) && !p.magaza_adi.toLocaleLowerCase("tr-TR").includes(q)) return false;
      }
      return true;
    });
  }, [personel, arama, sadeceEksik]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="İsim veya mağaza ara..."
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1 max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input type="checkbox" checked={sadeceEksik} onChange={(e) => setSadeceEksik(e.target.checked)} />
          Sadece maaşı girilmemiş olanlar
        </label>
        <div className="text-[11px] text-gray-400 ml-auto">{filtrelenmis.length} / {personel.length} personel</div>
      </div>

      <div className="max-h-[500px] overflow-y-auto border border-gray-100 rounded-md">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase sticky top-0">
              <th className="text-left px-2 py-1.5">Ad Soyad</th>
              <th className="text-left px-2 py-1.5">Ünvan</th>
              <th className="text-left px-2 py-1.5">Mağaza</th>
              <th className="text-right px-2 py-1.5">Kıdem</th>
              <th className="text-right px-2 py-1.5">Brüt Maaş (prim/ek ücret hariç)</th>
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.map((p) => <MaasSatiri key={p.id} p={p} />)}
            {filtrelenmis.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-6 text-center text-gray-400">Bu filtreye uyan personel yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
