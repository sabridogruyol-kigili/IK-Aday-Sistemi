"use client";

import { useState, useTransition } from "react";
import { guncelleMagaza, ekleMagaza, magazayiPasifYap, type MagazaGuncelleGirdi } from "./actions";

type Magaza = {
  id: string; magaza_kodu: string; magaza_adi: string; bolge_id: string | null;
  subetipi: string | null; net_m2: number | null; aktif: boolean;
  ana_kadro_norm: number; donemsel_norm: number; part_time_norm: number;
};
type Bolge = { id: string; ad: string };

const BOS_SATIR = {
  magaza_kodu: "", magaza_adi: "", bolge_id: "", subetipi: "", net_m2: "",
  ana_kadro_norm: "0", donemsel_norm: "0", part_time_norm: "0", aktif: true,
};

function Girdi({ value, onChange, tip = "text", genislik = "w-full" }: { value: string; onChange: (v: string) => void; tip?: string; genislik?: string }) {
  return (
    <input
      type={tip}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${genislik} border border-gray-200 rounded px-1.5 py-1 text-xs focus:border-navy outline-none`}
    />
  );
}

export default function MagazaTablosu({ magazalar, bolgeler }: { magazalar: Magaza[]; bolgeler: Bolge[] }) {
  const [pending, startTransition] = useTransition();
  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);
  const [taslak, setTaslak] = useState<Record<string, string | boolean>>({});
  const [yeniSatirAcik, setYeniSatirAcik] = useState(false);
  const [yeniTaslak, setYeniTaslak] = useState<typeof BOS_SATIR>(BOS_SATIR);
  const [error, setError] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("");
  const [sadeceAktif, setSadeceAktif] = useState(true);

  function duzenlemeyeBasla(m: Magaza) {
    setDuzenlenenId(m.id);
    setTaslak({
      magaza_kodu: m.magaza_kodu, magaza_adi: m.magaza_adi, bolge_id: m.bolge_id ?? "",
      subetipi: m.subetipi ?? "", net_m2: m.net_m2 != null ? String(m.net_m2) : "",
      ana_kadro_norm: String(m.ana_kadro_norm), donemsel_norm: String(m.donemsel_norm), part_time_norm: String(m.part_time_norm),
      aktif: m.aktif,
    });
    setError(null);
  }

  function kaydet(id: string) {
    setError(null);
    const girdi: MagazaGuncelleGirdi = {
      id,
      magaza_kodu: String(taslak.magaza_kodu ?? ""),
      magaza_adi: String(taslak.magaza_adi ?? ""),
      bolge_id: String(taslak.bolge_id ?? ""),
      subetipi: String(taslak.subetipi ?? "") || null,
      net_m2: taslak.net_m2 ? Number(taslak.net_m2) : null,
      aktif: Boolean(taslak.aktif),
      ana_kadro_norm: Number(taslak.ana_kadro_norm) || 0,
      donemsel_norm: Number(taslak.donemsel_norm) || 0,
      part_time_norm: Number(taslak.part_time_norm) || 0,
    };
    startTransition(async () => {
      const res = await guncelleMagaza(girdi);
      if (res?.error) { setError(res.error); return; }
      setDuzenlenenId(null);
    });
  }

  function yeniEkle() {
    setError(null);
    const girdi = {
      magaza_kodu: yeniTaslak.magaza_kodu,
      magaza_adi: yeniTaslak.magaza_adi,
      bolge_id: yeniTaslak.bolge_id,
      subetipi: yeniTaslak.subetipi || null,
      net_m2: yeniTaslak.net_m2 ? Number(yeniTaslak.net_m2) : null,
      aktif: yeniTaslak.aktif,
      ana_kadro_norm: Number(yeniTaslak.ana_kadro_norm) || 0,
      donemsel_norm: Number(yeniTaslak.donemsel_norm) || 0,
      part_time_norm: Number(yeniTaslak.part_time_norm) || 0,
    };
    startTransition(async () => {
      const res = await ekleMagaza(girdi);
      if (res?.error) { setError(res.error); return; }
      setYeniTaslak(BOS_SATIR);
      setYeniSatirAcik(false);
    });
  }

  function pasifYap(id: string, ad: string) {
    if (!confirm(`"${ad}" mağazasını pasif yapmak istediğinize emin misiniz?`)) return;
    const fd = new FormData(); fd.set("id", id);
    startTransition(async () => {
      const res = await magazayiPasifYap(fd);
      if (res?.error) alert(res.error);
    });
  }

  const gorunenler = magazalar.filter((m) => {
    if (sadeceAktif && !m.aktif) return false;
    if (filtre && !`${m.magaza_kodu} ${m.magaza_adi}`.toLocaleLowerCase("tr-TR").includes(filtre.toLocaleLowerCase("tr-TR"))) return false;
    return true;
  });

  return (
    <div>
      <div className="flex gap-2 mb-2 items-center">
        <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Mağaza kodu/adı ara..."
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-56" />
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input type="checkbox" checked={sadeceAktif} onChange={(e) => setSadeceAktif(e.target.checked)} />
          Sadece aktif
        </label>
        <div className="flex-1" />
        <button onClick={() => setYeniSatirAcik((v) => !v)} className="bg-navy text-white rounded-md px-3 py-1.5 text-xs font-medium">
          + Yeni Mağaza
        </button>
      </div>

      {error && <div className="text-[11px] text-danger mb-2">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-card overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
              <th className="text-left px-2 py-2">Kod</th>
              <th className="text-left px-2 py-2">Ad</th>
              <th className="text-left px-2 py-2">Bölge</th>
              <th className="text-left px-2 py-2">Subetipi</th>
              <th className="text-left px-2 py-2">Net m²</th>
              <th className="text-left px-2 py-2">Ana Kadro</th>
              <th className="text-left px-2 py-2">Dönemsel</th>
              <th className="text-left px-2 py-2">Part Time</th>
              <th className="text-left px-2 py-2">Durum</th>
              <th className="text-left px-2 py-2">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {yeniSatirAcik && (
              <tr className="border-t border-gray-100 bg-info-bg/30">
                <td className="px-2 py-1.5"><Girdi value={yeniTaslak.magaza_kodu} onChange={(v) => setYeniTaslak({ ...yeniTaslak, magaza_kodu: v })} genislik="w-20" /></td>
                <td className="px-2 py-1.5"><Girdi value={yeniTaslak.magaza_adi} onChange={(v) => setYeniTaslak({ ...yeniTaslak, magaza_adi: v })} genislik="w-40" /></td>
                <td className="px-2 py-1.5">
                  <select value={yeniTaslak.bolge_id} onChange={(e) => setYeniTaslak({ ...yeniTaslak, bolge_id: e.target.value })}
                    className="border border-gray-200 rounded px-1.5 py-1 text-xs w-32">
                    <option value="">Seçin</option>
                    {bolgeler.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5"><Girdi value={yeniTaslak.subetipi} onChange={(v) => setYeniTaslak({ ...yeniTaslak, subetipi: v })} genislik="w-20" /></td>
                <td className="px-2 py-1.5"><Girdi value={yeniTaslak.net_m2} onChange={(v) => setYeniTaslak({ ...yeniTaslak, net_m2: v })} tip="number" genislik="w-16" /></td>
                <td className="px-2 py-1.5"><Girdi value={yeniTaslak.ana_kadro_norm} onChange={(v) => setYeniTaslak({ ...yeniTaslak, ana_kadro_norm: v })} tip="number" genislik="w-14" /></td>
                <td className="px-2 py-1.5"><Girdi value={yeniTaslak.donemsel_norm} onChange={(v) => setYeniTaslak({ ...yeniTaslak, donemsel_norm: v })} tip="number" genislik="w-14" /></td>
                <td className="px-2 py-1.5"><Girdi value={yeniTaslak.part_time_norm} onChange={(v) => setYeniTaslak({ ...yeniTaslak, part_time_norm: v })} tip="number" genislik="w-14" /></td>
                <td className="px-2 py-1.5 text-gray-400">Aktif</td>
                <td className="px-2 py-1.5">
                  <button onClick={yeniEkle} disabled={pending} className="bg-success text-white rounded px-2 py-1 text-[10px] font-medium disabled:opacity-50">Ekle</button>
                  <button onClick={() => setYeniSatirAcik(false)} className="text-[10px] text-gray-400 ml-1.5">Vazgeç</button>
                </td>
              </tr>
            )}

            {gorunenler.map((m) => {
              const duzenleniyor = duzenlenenId === m.id;
              return (
                <tr key={m.id} className={`border-t border-gray-100 ${!m.aktif ? "opacity-50" : ""}`}>
                  {duzenleniyor ? (
                    <>
                      <td className="px-2 py-1.5"><Girdi value={String(taslak.magaza_kodu)} onChange={(v) => setTaslak({ ...taslak, magaza_kodu: v })} genislik="w-20" /></td>
                      <td className="px-2 py-1.5"><Girdi value={String(taslak.magaza_adi)} onChange={(v) => setTaslak({ ...taslak, magaza_adi: v })} genislik="w-40" /></td>
                      <td className="px-2 py-1.5">
                        <select value={String(taslak.bolge_id)} onChange={(e) => setTaslak({ ...taslak, bolge_id: e.target.value })}
                          className="border border-gray-200 rounded px-1.5 py-1 text-xs w-32">
                          <option value="">Seçin</option>
                          {bolgeler.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><Girdi value={String(taslak.subetipi)} onChange={(v) => setTaslak({ ...taslak, subetipi: v })} genislik="w-20" /></td>
                      <td className="px-2 py-1.5"><Girdi value={String(taslak.net_m2)} onChange={(v) => setTaslak({ ...taslak, net_m2: v })} tip="number" genislik="w-16" /></td>
                      <td className="px-2 py-1.5"><Girdi value={String(taslak.ana_kadro_norm)} onChange={(v) => setTaslak({ ...taslak, ana_kadro_norm: v })} tip="number" genislik="w-14" /></td>
                      <td className="px-2 py-1.5"><Girdi value={String(taslak.donemsel_norm)} onChange={(v) => setTaslak({ ...taslak, donemsel_norm: v })} tip="number" genislik="w-14" /></td>
                      <td className="px-2 py-1.5"><Girdi value={String(taslak.part_time_norm)} onChange={(v) => setTaslak({ ...taslak, part_time_norm: v })} tip="number" genislik="w-14" /></td>
                      <td className="px-2 py-1.5">
                        <label className="flex items-center gap-1 text-[10px]">
                          <input type="checkbox" checked={Boolean(taslak.aktif)} onChange={(e) => setTaslak({ ...taslak, aktif: e.target.checked })} />
                          Aktif
                        </label>
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => kaydet(m.id)} disabled={pending} className="bg-success text-white rounded px-2 py-1 text-[10px] font-medium disabled:opacity-50">Kaydet</button>
                        <button onClick={() => setDuzenlenenId(null)} className="text-[10px] text-gray-400 ml-1.5">Vazgeç</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2 font-mono text-gray-500">{m.magaza_kodu}</td>
                      <td className="px-2 py-2 font-medium text-navy-3">{m.magaza_adi}</td>
                      <td className="px-2 py-2 text-gray-500">{bolgeler.find((b) => b.id === m.bolge_id)?.ad ?? "—"}</td>
                      <td className="px-2 py-2 text-gray-500">{m.subetipi ?? "—"}</td>
                      <td className="px-2 py-2 text-gray-500">{m.net_m2 ?? "—"}</td>
                      <td className="px-2 py-2">{m.ana_kadro_norm}</td>
                      <td className="px-2 py-2">{m.donemsel_norm}</td>
                      <td className="px-2 py-2">{m.part_time_norm}</td>
                      <td className="px-2 py-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.aktif ? "bg-success-bg text-success" : "bg-gray-100 text-gray-500"}`}>
                          {m.aktif ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <button onClick={() => duzenlemeyeBasla(m)} className="text-info hover:underline mr-2">Düzenle</button>
                        {m.aktif && <button onClick={() => pasifYap(m.id, m.magaza_adi)} className="text-danger hover:underline">Pasif Yap</button>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {gorunenler.length === 0 && (
              <tr><td colSpan={10} className="px-2 py-6 text-center text-gray-400">Bu filtreye uyan mağaza yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
