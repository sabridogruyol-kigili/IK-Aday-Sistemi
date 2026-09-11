"use client";

import { useMemo, useState } from "react";
import { guncelleMagazaAdresKonum } from "./actions";

type Magaza = { id: string; magaza_kodu: string; magaza_adi: string; adres: string | null; konum_link: string | null };

function MagazaSatiri({ m }: { m: Magaza }) {
  const [adres, setAdres] = useState(m.adres ?? "");
  const [konumLink, setKonumLink] = useState(m.konum_link ?? "");
  const [pending, setPending] = useState(false);
  const [durum, setDurum] = useState<"idle" | "ok" | "hata">("idle");

  function kaydet() {
    setPending(true);
    setDurum("idle");
    const fd = new FormData();
    fd.set("magaza_id", m.id);
    fd.set("adres", adres);
    fd.set("konum_link", konumLink);
    guncelleMagazaAdresKonum(fd).then((res) => {
      setPending(false);
      setDurum(res?.error ? "hata" : "ok");
    });
  }

  return (
    <tr className="border-t border-gray-50 align-top">
      <td className="px-2 py-1.5 text-navy-3 font-medium whitespace-nowrap">{m.magaza_kodu}</td>
      <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{m.magaza_adi}</td>
      <td className="px-2 py-1.5">
        <textarea value={adres} onChange={(e) => { setAdres(e.target.value); setDurum("idle"); }}
          placeholder="Mağaza adresi..." rows={2}
          className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs resize-none" />
      </td>
      <td className="px-2 py-1.5">
        <input value={konumLink} onChange={(e) => { setKonumLink(e.target.value); setDurum("idle"); }}
          placeholder="Google Maps linki..."
          className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs" />
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <button onClick={kaydet} disabled={pending}
            className="text-[11px] bg-navy hover:bg-navy-2 text-white rounded-md px-2 py-1 disabled:opacity-50 transition-colors shrink-0">
            {pending ? "..." : "Kaydet"}
          </button>
          {durum === "ok" && <span className="text-success text-xs">✓</span>}
          {durum === "hata" && <span className="text-danger text-xs">✗</span>}
        </div>
      </td>
    </tr>
  );
}

export default function MagazaAdresTablosu({ magazalar }: { magazalar: Magaza[] }) {
  const [arama, setArama] = useState("");
  const [sadeceEksik, setSadeceEksik] = useState(false);

  const filtrelenmis = useMemo(() => {
    return magazalar.filter((m) => {
      if (sadeceEksik && (m.adres || m.konum_link)) return false;
      if (arama) {
        const q = arama.toLocaleLowerCase("tr-TR");
        if (!m.magaza_adi.toLocaleLowerCase("tr-TR").includes(q) && !m.magaza_kodu.toLocaleLowerCase("tr-TR").includes(q)) return false;
      }
      return true;
    });
  }, [magazalar, arama, sadeceEksik]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Mağaza kodu veya adı ara..."
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1 max-w-xs" />
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input type="checkbox" checked={sadeceEksik} onChange={(e) => setSadeceEksik(e.target.checked)} />
          Sadece eksik olanlar
        </label>
        <div className="text-[11px] text-gray-400 ml-auto">{filtrelenmis.length} / {magazalar.length} mağaza</div>
      </div>

      <div className="max-h-[500px] overflow-y-auto border border-gray-100 rounded-md">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase sticky top-0">
              <th className="text-left px-2 py-1.5">Mağaza Kodu</th>
              <th className="text-left px-2 py-1.5">Mağaza Adı</th>
              <th className="text-left px-2 py-1.5">Mağaza Adresi</th>
              <th className="text-left px-2 py-1.5">Mağaza Konumu</th>
              <th className="text-left px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.map((m) => <MagazaSatiri key={m.id} m={m} />)}
            {filtrelenmis.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-6 text-center text-gray-400">Bu filtreye uyan mağaza yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
