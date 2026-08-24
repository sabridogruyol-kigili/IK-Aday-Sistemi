"use client";

import { useState, useTransition } from "react";
import { kararVerAday, ilerletDurum } from "./actions";

export default function AdayKarti({
  adayId, adSoyad, cvLink, talepNo, magaza, yonlendirenRol, kariVerenRol, durum, durumEtiket, benimRolum,
}: {
  adayId: string; adSoyad: string; cvLink: string | null; talepNo: string; magaza?: string;
  yonlendirenRol: string; kariVerenRol: string; durum: string; durumEtiket: string; benimRolum: string;
}) {
  const [pending, startTransition] = useTransition();
  const [redMod, setRedMod] = useState(false);
  const [aciklama, setAciklama] = useState("");
  const [tcKimlik, setTcKimlik] = useState("");
  const [error, setError] = useState<string | null>(null);

  const benKararVerebilirim = durum === "YONLENDIRILDI" && (benimRolum === kariVerenRol || benimRolum === "YONETIM");

  function karar(k: "ONAY" | "RED") {
    setError(null);
    const fd = new FormData();
    fd.set("aday_id", adayId); fd.set("karar", k); fd.set("aciklama", aciklama);
    startTransition(async () => {
      const res = await kararVerAday(fd);
      if (res?.error) setError(res.error);
    });
  }

  function ilerlet(yeniDurum: string, notAlani?: string) {
    setError(null);
    const fd = new FormData();
    fd.set("aday_id", adayId); fd.set("yeni_durum", yeniDurum);
    if (notAlani) fd.set("not", notAlani);
    if (yeniDurum === "ISE_ALINDI") fd.set("tc_kimlik_no", tcKimlik);
    startTransition(async () => {
      const res = await ilerletDurum(fd);
      if (res?.error) setError(res.error);
    });
  }

  const durumRenk: Record<string, string> = {
    YONLENDIRILDI: "text-accent", ONAYLANDI: "text-success", REDDEDILDI: "text-danger",
    ON_GORUSME_PLANLANDI: "text-info", GORUSULDU_OLUMLU: "text-success",
    GORUSULDU_OLUMSUZ: "text-danger", ISE_ALINDI: "text-success",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-medium text-navy-3 text-sm">{adSoyad}</div>
          <div className="text-xs text-gray-500 mt-0.5">{talepNo} — {magaza} — Yönlendiren: {yonlendirenRol}</div>
          {cvLink && <a href={cvLink} target="_blank" className="text-xs text-info underline">CV'yi Görüntüle</a>}
        </div>
        <span className={`text-xs font-medium ${durumRenk[durum] ?? ""}`}>{durumEtiket}</span>
      </div>

      {benKararVerebilirim && !redMod && (
        <div className="flex gap-2 mt-2">
          <button onClick={() => karar("ONAY")} disabled={pending} className="bg-success text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">Onayla</button>
          <button onClick={() => setRedMod(true)} disabled={pending} className="bg-danger-bg text-danger border border-danger/30 rounded-md px-3 py-1.5 text-xs font-medium">Reddet</button>
        </div>
      )}
      {benKararVerebilirim && redMod && (
        <div className="space-y-2 mt-2">
          <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Red gerekçesi (zorunlu)" rows={2} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs" />
          <div className="flex gap-2">
            <button onClick={() => karar("RED")} disabled={pending || !aciklama.trim()} className="bg-danger text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">Reddi Onayla</button>
            <button onClick={() => setRedMod(false)} className="text-xs text-gray-400">Vazgeç</button>
          </div>
        </div>
      )}

      {durum === "ONAYLANDI" && (
        <button onClick={() => ilerlet("ON_GORUSME_PLANLANDI")} disabled={pending} className="mt-2 bg-info text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
          Ön Görüşme Planlandı Olarak İşaretle
        </button>
      )}

      {durum === "ON_GORUSME_PLANLANDI" && (
        <div className="flex gap-2 mt-2">
          <button onClick={() => ilerlet("GORUSULDU_OLUMLU")} disabled={pending} className="bg-success text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">Görüşüldü — Olumlu</button>
          <button onClick={() => ilerlet("GORUSULDU_OLUMSUZ")} disabled={pending} className="bg-danger text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">Görüşüldü — Olumsuz</button>
        </div>
      )}

      {durum === "GORUSULDU_OLUMLU" && (
        <div className="flex gap-2 mt-2 items-center">
          <input value={tcKimlik} onChange={(e) => setTcKimlik(e.target.value)} placeholder="TC Kimlik No" className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-40" />
          <button onClick={() => ilerlet("ISE_ALINDI")} disabled={pending || !tcKimlik.trim()} className="bg-success text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
            İşe Aldım
          </button>
        </div>
      )}

      {error && <div className="text-xs text-danger mt-2">{error}</div>}
    </div>
  );
}
