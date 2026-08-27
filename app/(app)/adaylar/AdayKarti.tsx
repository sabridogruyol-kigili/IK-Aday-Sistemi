"use client";

import { useState, useTransition } from "react";
import { kararVerAday, ilerletDurum, getAdaySurecGecmisi, mulakatIsaretle } from "./actions";
import SurecTarihce, { type SurecAdimi } from "../talepler/SurecTarihce";

export default function AdayKarti({
  adayId, adSoyad, telefon, email, cvLink, talepNo, magaza,
  yonlendirenRol, yonlendirenKullaniciId, kariVerenRol, onayBm, onayIk, mulakatBm, mulakatIk,
  durum, durumEtiket, benimKullaniciId, benimRolum,
}: {
  adayId: string; adSoyad: string; telefon: string | null; email: string | null; cvLink: string | null;
  talepNo: string; magaza?: string; yonlendirenRol: string; yonlendirenKullaniciId: string;
  kariVerenRol: string; onayBm: string | null; onayIk: string | null; mulakatBm: string | null; mulakatIk: string | null;
  durum: string; durumEtiket: string; benimKullaniciId: string; benimRolum: string;
}) {
  const [pending, startTransition] = useTransition();
  const [redMod, setRedMod] = useState(false);
  const [aciklama, setAciklama] = useState("");
  const [tcKimlik, setTcKimlik] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tarihceAcik, setTarihceAcik] = useState(false);
  const [tarihce, setTarihce] = useState<SurecAdimi[]>([]);

  // Sunucudan onay dönene kadar beklemek yerine, aksiyon sonrası dönen veriyle anında güncellenen yerel durum.
  const [durumL, setDurumL] = useState(durum);
  const [onayBmL, setOnayBmL] = useState(onayBm);
  const [onayIkL, setOnayIkL] = useState(onayIk);
  const [mulakatBmL, setMulakatBmL] = useState(mulakatBm);
  const [mulakatIkL, setMulakatIkL] = useState(mulakatIk);

  const benKararVerebilirim =
    durumL === "YONLENDIRILDI" &&
    yonlendirenKullaniciId !== benimKullaniciId &&
    (
      (kariVerenRol === "BM" && benimRolum === "BM") ||
      (kariVerenRol === "IK" && benimRolum === "IK") ||
      (kariVerenRol === "BM_VE_IK" && benimRolum === "BM" && !onayBmL) ||
      (kariVerenRol === "BM_VE_IK" && benimRolum === "IK" && !onayIkL)
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
      if (res.aday) {
        setDurumL(res.aday.durum);
        setOnayBmL(res.aday.onay_bm);
        setOnayIkL(res.aday.onay_ik);
      }
    });
  }

  function mulakatDegistir(rol: "BM" | "IK", mevcutDeger: string | null) {
    const yeniDeger = mevcutDeger === "YAPILDI" ? "YAPILMADI" : "YAPILDI";
    if (rol === "BM") setMulakatBmL(yeniDeger); else setMulakatIkL(yeniDeger);
    const fd = new FormData();
    fd.set("aday_id", adayId); fd.set("rol", rol); fd.set("durum", yeniDeger);
    mulakatIsaretle(fd).then((res) => {
      if (res?.error) {
        setError(res.error);
        if (rol === "BM") setMulakatBmL(mevcutDeger); else setMulakatIkL(mevcutDeger);
      }
    });
  }

  function ilerlet(yeniDurum: string) {
    setError(null);
    const fd = new FormData();
    fd.set("aday_id", adayId); fd.set("yeni_durum", yeniDurum);
    if (yeniDurum === "ISE_ALINDI") fd.set("tc_kimlik_no", tcKimlik);
    startTransition(async () => {
      const res = await ilerletDurum(fd);
      if (res?.error) { setError(res.error); return; }
      if (res.aday) setDurumL(res.aday.durum);
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
  const durumEtiketMap: Record<string, string> = {
    YONLENDIRILDI: "Yönlendirildi", ONAYLANDI: "Onaylandı", REDDEDILDI: "Reddedildi",
    ON_GORUSME_PLANLANDI: "Ön Görüşme Planlandı", GORUSULDU_OLUMLU: "Görüşüldü — Olumlu",
    GORUSULDU_OLUMSUZ: "Görüşüldü — Olumsuz", ISE_ALINDI: "İşe Alındı",
  };
  const durumEtiketL = durumEtiketMap[durumL] ?? durumEtiket;

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
        <span className={`text-xs font-medium ${durumRenk[durumL] ?? ""}`}>{durumEtiketL}</span>
      </div>

      {durumL === "YONLENDIRILDI" && kariVerenRol === "BM_VE_IK" && (
        <div className="text-[10px] text-gray-400 mb-2">
          BM: {onayBmL === "ONAY" ? "✓ Onayladı" : onayBmL === "RED" ? "✗ Reddetti" : "Bekliyor"}
          {" · "}
          İK: {onayIkL === "ONAY" ? "✓ Onayladı" : onayIkL === "RED" ? "✗ Reddetti" : "Bekliyor"}
        </div>
      )}

      {durumL === "YONLENDIRILDI" && (
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => (benimRolum === "BM" || benimRolum === "YONETIM") && mulakatDegistir("BM", mulakatBmL)}
            disabled={pending || !(benimRolum === "BM" || benimRolum === "YONETIM")}
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              mulakatBmL === "YAPILDI" ? "bg-success-bg text-success"
              : mulakatBmL === "YAPILMADI" ? "bg-danger-bg text-danger"
              : "bg-gray-100 text-gray-400"
            } ${(benimRolum === "BM" || benimRolum === "YONETIM") ? "cursor-pointer hover:opacity-75" : "cursor-default"}`}
          >
            BM Mülakat: {mulakatBmL === "YAPILDI" ? "Yapıldı ✓" : mulakatBmL === "YAPILMADI" ? "Yapılmadı ✗" : "İşaretlenmedi"}
          </button>
          <button
            onClick={() => (benimRolum === "IK" || benimRolum === "YONETIM") && mulakatDegistir("IK", mulakatIkL)}
            disabled={pending || !(benimRolum === "IK" || benimRolum === "YONETIM")}
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              mulakatIkL === "YAPILDI" ? "bg-success-bg text-success"
              : mulakatIkL === "YAPILMADI" ? "bg-danger-bg text-danger"
              : "bg-gray-100 text-gray-400"
            } ${(benimRolum === "IK" || benimRolum === "YONETIM") ? "cursor-pointer hover:opacity-75" : "cursor-default"}`}
          >
            İK Mülakat: {mulakatIkL === "YAPILDI" ? "Yapıldı ✓" : mulakatIkL === "YAPILMADI" ? "Yapılmadı ✗" : "İşaretlenmedi"}
          </button>
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

      {durumL === "ONAYLANDI" && (
        <button onClick={() => ilerlet("ON_GORUSME_PLANLANDI")} disabled={pending} className="mt-2 bg-info text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
          Ön Görüşme Planlandı Olarak İşaretle
        </button>
      )}

      {durumL === "ON_GORUSME_PLANLANDI" && (
        <div className="flex gap-2 mt-2">
          <button onClick={() => ilerlet("GORUSULDU_OLUMLU")} disabled={pending} className="bg-success text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">Görüşüldü — Olumlu</button>
          <button onClick={() => ilerlet("GORUSULDU_OLUMSUZ")} disabled={pending} className="bg-danger text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">Görüşüldü — Olumsuz</button>
        </div>
      )}

      {durumL === "GORUSULDU_OLUMLU" && (
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
        <div className="mt-2 border border-gray-100 rounded-md p-2 bg-gray-50/50 w-full">
          <SurecTarihce olaylar={tarihce} />
        </div>
      )}
    </div>
  );
}
