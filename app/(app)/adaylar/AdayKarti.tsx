"use client";

import { useState, useTransition } from "react";
import { kararVerAday, ilerletDurum, getAdaySurecGecmisi } from "./actions";
import SurecTarihce, { type TarihceOlay } from "../talepler/SurecTarihce";

export default function AdayKarti({
  adayId, adSoyad, telefon, email, cvLink, talepNo, magaza,
  yonlendirenRol, yonlendirenKullaniciId, kariVerenRol, onayBm, onayIk,
  durum, durumEtiket, benimKullaniciId, benimRolum,
}: {
  adayId: string; adSoyad: string; telefon: string | null; email: string | null; cvLink: string | null;
  talepNo: string; magaza?: string; yonlendirenRol: string; yonlendirenKullaniciId: string;
  kariVerenRol: string; onayBm: string | null; onayIk: string | null;
  durum: string; durumEtiket: string; benimKullaniciId: string; benimRolum: string;
}) {
  const [pending, startTransition] = useTransition();
  const [redMod, setRedMod] = useState(false);
  const [aciklama, setAciklama] = useState("");
  const [tcKimlik, setTcKimlik] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tarihceAcik, setTarihceAcik] = useState(false);
  const [tarihce, setTarihce] = useState<TarihceOlay[]>([]);

  const benKararVerebilirim =
    durum === "YONLENDIRILDI" &&
    yonlendirenKullaniciId !== benimKullaniciId &&
    (
      (kariVerenRol === "BM" && benimRolum === "BM") ||
      (kariVerenRol === "IK" && benimRolum === "IK") ||
      (kariVerenRol === "BM_VE_IK" && benimRolum === "BM" && !onayBm) ||
      (kariVerenRol === "BM_VE_IK" && benimRolum === "IK" && !onayIk)
    );

  function karar(k: "ONAY" | "RED") {
    setError(null);
    const fd = new FormData();
    fd.set("aday_id", adayId); fd.set("karar", k); fd.set("aciklama", aciklama);
    startTransition(async () => {
      const res = await kararVerAday(fd);
      if (res?.error) { setError(res.error); return; }
      setRedMod(false);
      setAciklama("");
    });
  }

  function ilerlet(yeniDurum: string) {
    setError(null);
    const fd = new FormData();
    fd.set("aday_id", adayId); fd.set("yeni_durum", yeniDurum);
    if (yeniDurum === "ISE_ALINDI") fd.set("tc_kimlik_no", tcKimlik);
    startTransition(async () => {
      const res = await ilerletDurum(fd);
      if (res?.error) setError(res.error);
    });
  }

  function tarihceyiAcKapa() {
    if (!tarihceAcik) {
      getAdaySurecGecmisi(adayId).then((res) => setTarihce(res.data));
    }
    setTarihceAcik(!tarihceAcik);
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
          <div className="text-[11px] text-gray-400 mt-0.5">
            {telefon ?? "Telefon —"} · {email ?? "E-posta —"}
          </div>
          {cvLink && <span className="text-xs text-success">CV kayıtlı</span>}
        </div>
        <span className={`text-xs font-medium ${durumRenk[durum] ?? ""}`}>{durumEtiket}</span>
      </div>

      {durum === "YONLENDIRILDI" && kariVerenRol === "BM_VE_IK" && (
        <div className="text-[10px] text-gray-400 mb-2">
          BM: {onayBm === "ONAY" ? "✓ Onayladı" : onayBm === "RED" ? "✗ Reddetti" : "Bekliyor"}
          {" · "}
          İK: {onayIk === "ONAY" ? "✓ Onayladı" : onayIk === "RED" ? "✗ Reddetti" : "Bekliyor"}
        </div>
      )}

      {benKararVerebilirim && !redMod && (
        <div className="flex gap-2 mt-2">
          <button onClick={() => karar("ONAY")} disabled={pending} className="bg-success text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">Onayla</button>
          <button onClick={() => setRedMod(true)} disabled={pending} className="bg-danger-bg text-danger border border-danger/30 rounded-md px-3 py-1.5 text-xs font-medium">Reddet</button>
        </div>
      )}
      {benKararVerebilirim && redMod && (
        <div className="space-y-2 mt-2">
          <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Red gerekçesi (en az 100 karakter, zorunlu)" rows={3} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs" />
          <div className={`text-[10px] ${aciklama.trim().length >= 100 ? "text-success" : "text-gray-400"}`}>{aciklama.trim().length} / 100 karakter</div>
          <div className="flex gap-2">
            <button onClick={() => karar("RED")} disabled={pending || aciklama.trim().length < 100} className="bg-danger text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">Reddi Onayla</button>
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

      <button onClick={tarihceyiAcKapa}
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium mt-2 transition-colors ${
          tarihceAcik ? "bg-navy text-white border-navy" : "bg-gray-50 text-gray-500 border-gray-200 hover:border-navy hover:bg-white"
        }`}>
        <span>🕐 Süreç detayı</span>
        <span className={`text-[7px] transition-transform ${tarihceAcik ? "rotate-180" : ""}`}>▼</span>
      </button>
      {tarihceAcik && (
        <div className="mt-2 border border-gray-100 rounded-md p-2 bg-gray-50/50">
          <SurecTarihce olaylar={tarihce} />
        </div>
      )}
    </div>
  );
}
