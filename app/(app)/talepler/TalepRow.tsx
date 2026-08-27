"use client";

import { useState, useTransition, Fragment } from "react";
import { getAdaylarByTalep, deleteAday, kararVerAday, ilerletDurum, getAdaySurecGecmisi, mulakatIsaretle } from "../adaylar/actions";
import { getTalepTarihcesi, type SurecAdimi } from "./actions";
import RevizyonForm from "./RevizyonForm";
import CvModal from "./CvModal";
import AdayEkleModal from "./AdayEkleModal";
import AdayStepper from "./AdayStepper";
import IseAlModal from "./IseAlModal";
import SurecTarihce from "./SurecTarihce";

const TALEP_TURU_ETIKET: Record<string, string> = { ISE_ALIM: "İşe Alım", ISTEN_CIKARMA: "İşten Çıkarma" };
const DURUM_RENK: Record<string, string> = {
  BEKLEMEDE: "text-accent", KABUL_EDILDI: "text-success", DURAKLADI: "text-danger", KAPANDI_RED: "text-danger", ISLEME_DEVAM: "text-info",
};
const DURUM_KENARLIK: Record<string, string> = {
  BEKLEMEDE: "border-l-accent", KABUL_EDILDI: "border-l-success", DURAKLADI: "border-l-danger",
  KAPANDI_RED: "border-l-danger", ISLEME_DEVAM: "border-l-info",
};
const ADAY_DURUM_ETIKET: Record<string, string> = {
  YONLENDIRILDI: "Yönlendirildi", ONAYLANDI: "Onaylandı", REDDEDILDI: "Reddedildi",
  ON_GORUSME_PLANLANDI: "Ön Görüşme", GORUSULDU_OLUMLU: "Olumlu", GORUSULDU_OLUMSUZ: "Olumsuz", ISE_ALINDI: "İşe Alındı",
};
const ADAY_DURUM_RENK: Record<string, string> = {
  YONLENDIRILDI: "bg-accent/10 text-accent", ONAYLANDI: "bg-success-bg text-success", REDDEDILDI: "bg-danger-bg text-danger",
  ON_GORUSME_PLANLANDI: "bg-info-bg text-info", GORUSULDU_OLUMLU: "bg-success-bg text-success",
  GORUSULDU_OLUMSUZ: "bg-danger-bg text-danger", ISE_ALINDI: "bg-success text-white",
};
const SUREC_OZET: Record<string, string> = {
  BEKLEMEDE: "Onay bekliyor", DURAKLADI: "Revizyon bekliyor", ISLEME_DEVAM: "İşlemde",
  KABUL_EDILDI: "Kabul edildi", KAPANDI_RED: "Kapandı — Red",
};

function inisiyal(adSoyad: string) {
  return adSoyad.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

type Talep = {
  id: string; talep_no: string; talep_turu: string; pozisyon_tipi: string | null; kisi_sayisi: number | null;
  durum: string; aktif_gonderim_no: number; created_at: string; magaza_grup_id: string | null; magazalar: { magaza_adi: string } | null;
};
type Aday = {
  id: string; ad_soyad: string; telefon: string | null; email: string | null; cinsiyet: string | null; cv_drive_link: string | null;
  yonlendiren_rol: string; karari_veren_rol: string; durum: string; yonlendiren_kullanici_id: string; onay_tarihi: string | null;
  onay_bm: string | null; onay_ik: string | null; mulakat_bm: string | null; mulakat_ik: string | null;
  tc_kimlik_no: string | null; ise_baslama_tarihi: string | null;
};

export default function TalepRow({
  talep, redGerekce, benimKullaniciId, benimRolum, baslangicAdaySayisi, acanAdi, acanRol, benimAcimMi, gorunumEtiket,
}: {
  talep: Talep; redGerekce?: string; benimKullaniciId: string; benimRolum: string; baslangicAdaySayisi: number;
  acanAdi?: string; acanRol?: string; benimAcimMi: boolean; gorunumEtiket?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [adayAcik, setAdayAcik] = useState(false);
  const [adaylar, setAdaylar] = useState<Aday[]>([]);
  const [adaySayisi, setAdaySayisi] = useState(baslangicAdaySayisi);
  const [cvModalAday, setCvModalAday] = useState<{ id: string; cv: string | null } | null>(null);
  const [ekleModalAcik, setEkleModalAcik] = useState(false);
  const [iseAlAdayId, setIseAlAdayId] = useState<string | null>(null);
  const [iseAlHata, setIseAlHata] = useState<string | null>(null);
  const [redModAdayId, setRedModAdayId] = useState<string | null>(null);
  const [redAciklama, setRedAciklama] = useState("");
  const [talepTarihceAcik, setTalepTarihceAcik] = useState(false);
  const [talepTarihce, setTalepTarihce] = useState<SurecAdimi[]>([]);
  const [talepTarihcePending, setTalepTarihcePending] = useState(false);
  const [adayTarihceAcikId, setAdayTarihceAcikId] = useState<string | null>(null);
  const [adayTarihce, setAdayTarihce] = useState<SurecAdimi[]>([]);

  function talepTarihceyiAcKapa() {
    if (!talepTarihceAcik) {
      setTalepTarihcePending(true);
      getTalepTarihcesi(talep.id).then((res) => {
        setTalepTarihce(res.data);
        setTalepTarihcePending(false);
      });
    }
    setTalepTarihceAcik(!talepTarihceAcik);
  }

  function adayTarihceyiAcKapa(adayId: string) {
    if (adayTarihceAcikId === adayId) {
      setAdayTarihceAcikId(null);
      return;
    }
    setAdayTarihceAcikId(adayId);
    getAdaySurecGecmisi(adayId).then((res) => setAdayTarihce(res.data));
  }

  function adaylariYukle() {
    startTransition(async () => {
      const res = await getAdaylarByTalep(talep.id);
      setAdaylar(res.data as Aday[]);
      setAdaySayisi(res.data.length);
    });
  }

  function toggleAday() {
    if (!adayAcik) adaylariYukle();
    setAdayAcik(!adayAcik);
  }

  function sil(adayId: string) {
    const fd = new FormData(); fd.set("aday_id", adayId);
    startTransition(async () => {
      const res = await deleteAday(fd);
      if (res?.error) { alert(res.error); return; }
      adaylariYukle();
    });
  }

  function karar(adayId: string, k: "ONAY" | "RED", aciklama?: string) {
    const fd = new FormData(); fd.set("aday_id", adayId); fd.set("karar", k); fd.set("aciklama", aciklama ?? "");
    startTransition(async () => {
      const res = await kararVerAday(fd);
      if (res?.error) { alert(res.error); return; }
      setRedModAdayId(null);
      setRedAciklama("");
      adaylariYukle();
    });
  }

  function mulakatDegistir(adayId: string, rol: "BM" | "IK", mevcutDeger: string | null) {
    // Döngü: işaretsiz -> Yapıldı -> Yapılmadı -> işaretsize benzer şekilde Yapıldı'ya döner (temizleme ihtiyacı azdır)
    const yeniDeger = mevcutDeger === "YAPILDI" ? "YAPILMADI" : "YAPILDI";
    const fd = new FormData(); fd.set("aday_id", adayId); fd.set("rol", rol); fd.set("durum", yeniDeger);
    startTransition(async () => {
      const res = await mulakatIsaretle(fd);
      if (res?.error) { alert(res.error); return; }
      adaylariYukle();
    });
  }

  function ilerlet(adayId: string, yeniDurum: string) {
    const fd = new FormData(); fd.set("aday_id", adayId); fd.set("yeni_durum", yeniDurum);
    startTransition(async () => {
      const res = await ilerletDurum(fd);
      if (res?.error) { alert(res.error); return; }
      adaylariYukle();
    });
  }

  function iseAlOnayla(tc: string, baslangic: string) {
    if (!iseAlAdayId) return;
    setIseAlHata(null);
    const fd = new FormData();
    fd.set("aday_id", iseAlAdayId);
    fd.set("yeni_durum", "ISE_ALINDI");
    fd.set("tc_kimlik_no", tc);
    fd.set("baslangic_tarihi", baslangic);
    startTransition(async () => {
      const res = await ilerletDurum(fd);
      if (res?.error) {
        setIseAlHata(res.error);
        return;
      }
      setIseAlAdayId(null);
      adaylariYukle();
    });
  }

  const gosterAdayButonu = talep.talep_turu === "ISE_ALIM" && talep.durum === "KABUL_EDILDI";

  return (
    <>
      <tr className={`border-t border-gray-100 border-l-4 ${DURUM_KENARLIK[talep.durum] ?? "border-l-transparent"} align-top hover:bg-gray-50/50`}>
        <td className="px-3 py-2.5 font-mono text-navy-3">
          {talep.talep_no}
          {talep.magaza_grup_id && (
            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full bg-accent/20 text-navy-3 text-[9px] font-sans font-medium align-middle">
              Toplu Talep Grubu
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-gray-600">{TALEP_TURU_ETIKET[talep.talep_turu] ?? talep.talep_turu}</td>
        <td className="px-3 py-2.5 text-gray-600">{talep.magazalar?.magaza_adi}</td>
        <td className="px-3 py-2.5 text-gray-600">{acanAdi} <span className="text-gray-400">({acanRol})</span></td>
        <td className="px-3 py-2.5 text-gray-600">{talep.pozisyon_tipi ?? "—"}</td>
        <td className="px-3 py-2.5 text-gray-600">{talep.kisi_sayisi ?? "—"}</td>
        <td className="px-3 py-2.5 text-gray-600">{talep.aktif_gonderim_no}/3</td>
        <td className="px-3 py-2.5">
          <div className={`font-medium ${DURUM_RENK[talep.durum] ?? ""}`}>{gorunumEtiket ?? talep.durum}</div>
          {talep.durum === "DURAKLADI" && redGerekce && (
            <div className="text-[11px] text-gray-500 mt-0.5 max-w-[220px]">{redGerekce}</div>
          )}
          {talep.durum === "DURAKLADI" && talep.aktif_gonderim_no < 3 && benimAcimMi && (
            <RevizyonForm talepId={talep.id} />
          )}
          {talep.durum === "DURAKLADI" && talep.aktif_gonderim_no >= 3 && benimAcimMi && (
            <div className="text-[11px] text-gray-400 mt-0.5">3 deneme doldu, yeni talep açın</div>
          )}
        </td>
        <td className="px-3 py-2.5">
          <button
            onClick={talepTarihceyiAcKapa}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
              talepTarihceAcik ? "bg-navy text-white border-navy" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-navy hover:bg-white"
            }`}
          >
            <span>🕐</span>
            <span>{SUREC_OZET[talep.durum] ?? talep.durum}</span>
            <span className={`text-[8px] transition-transform ${talepTarihceAcik ? "rotate-180" : ""}`}>▼</span>
          </button>
        </td>
        <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{new Date(talep.created_at).toLocaleDateString("tr-TR")}</td>
        <td className="px-3 py-2.5">
          {gosterAdayButonu && (
            <button
              onClick={toggleAday}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                adayAcik
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-navy border-navy/20 hover:border-navy hover:bg-navy/5"
              }`}
            >
              <span className="text-[13px] leading-none">👤</span>
              <span>Adaylar</span>
              <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold ${
                adayAcik ? "bg-white text-navy" : "bg-accent text-navy-3"
              }`}>
                {adaySayisi}
              </span>
              <span className={`text-[9px] transition-transform ${adayAcik ? "rotate-180" : ""}`}>▼</span>
            </button>
          )}
        </td>
      </tr>

      {talepTarihceAcik && (
        <tr className="bg-gray-50/50 border-t border-gray-100">
          <td colSpan={11} className="px-6 py-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3 w-full">
              <div className="text-[11px] font-semibold text-navy-3 mb-2">Süreç Tarihçesi — {talep.talep_no}</div>
              {talepTarihcePending ? (
                <div className="text-[11px] text-gray-400">Yükleniyor...</div>
              ) : (
                <SurecTarihce olaylar={talepTarihce} />
              )}
            </div>
          </td>
        </tr>
      )}

      {adayAcik && (
        <tr className="bg-gray-50/70 border-t border-gray-100">
          <td colSpan={11} className="px-3 py-4">
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">

              <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="text-xs font-semibold text-navy-3">Adaylar</div>
                <button onClick={() => setEkleModalAcik(true)}
                  className="bg-navy text-white rounded-md px-3 py-1.5 text-xs font-medium">
                  + Yeni Aday Ekle
                </button>
              </div>

              {adaylar.length === 0 ? (
                <div className="p-5 text-center text-xs text-gray-400">
                  Bu talep için henüz aday yönlendirilmedi — "Yeni Aday Ekle" ile başlayın.
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
                      <th className="text-left px-3 py-2">Aday</th>
                      <th className="text-left px-3 py-2">Telefon</th>
                      <th className="text-left px-3 py-2">E-posta</th>
                      <th className="text-left px-3 py-2">Cinsiyet</th>
                      <th className="text-left px-3 py-2">Yönlendiren</th>
                      <th className="text-left px-3 py-2">CV</th>
                      <th className="text-left px-3 py-2">Süreç</th>
                      <th className="text-left px-3 py-2">Onay Tarihi</th>
                      <th className="text-left px-3 py-2">TC Kimlik No</th>
                      <th className="text-left px-3 py-2">İşe Başlama</th>
                      <th className="text-left px-3 py-2">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adaylar.map((a) => {
                      const benKararVerebilirim = a.durum === "YONLENDIRILDI"
                        && a.yonlendiren_kullanici_id !== benimKullaniciId
                        && (
                          (a.karari_veren_rol === "BM" && benimRolum === "BM")
                          || (a.karari_veren_rol === "IK" && benimRolum === "IK")
                          || (a.karari_veren_rol === "BM_VE_IK" && benimRolum === "BM" && !a.onay_bm)
                          || (a.karari_veren_rol === "BM_VE_IK" && benimRolum === "IK" && !a.onay_ik)
                        );
                      const benSilebilirim = a.durum === "YONLENDIRILDI" && (a.yonlendiren_kullanici_id === benimKullaniciId || benimRolum === "YONETIM");
                      return (
                        <Fragment key={a.id}>
                        <tr className="border-t border-gray-100">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-navy-3 flex-shrink-0">
                                {inisiyal(a.ad_soyad)}
                              </div>
                              <span className="font-medium text-navy-3">{a.ad_soyad}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">{a.telefon ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-600 text-[10px]">{a.email ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{a.cinsiyet ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded bg-navy/10 text-navy text-[10px] font-medium">
                              {a.yonlendiren_rol}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <button onClick={() => setCvModalAday({ id: a.id, cv: a.cv_drive_link })}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${a.cv_drive_link ? "bg-success-bg text-success" : "bg-gray-100 text-gray-500"}`}>
                              {a.cv_drive_link ? "CV Var — Güncelle" : "CV Ekle"}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <div className="space-y-1">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${ADAY_DURUM_RENK[a.durum] ?? ""}`}>
                                {ADAY_DURUM_ETIKET[a.durum]}
                              </span>
                              <AdayStepper durum={a.durum} />
                              {a.durum === "YONLENDIRILDI" && (
                                <div className="text-[10px] text-gray-400 mt-1">
                                  {a.karari_veren_rol === "BM_VE_IK" ? (
                                    <>
                                      BM: {a.onay_bm === "ONAY" ? "✓ Onayladı" : a.onay_bm === "RED" ? "✗ Reddetti" : "Bekliyor"}
                                      {" · "}
                                      İK: {a.onay_ik === "ONAY" ? "✓ Onayladı" : a.onay_ik === "RED" ? "✗ Reddetti" : "Bekliyor"}
                                    </>
                                  ) : (
                                    <>Onay bekliyor: {a.karari_veren_rol}</>
                                  )}
                                </div>
                              )}
                              {a.durum === "YONLENDIRILDI" && (
                                <div className="flex gap-1 mb-1">
                                  <button
                                    onClick={() => (benimRolum === "BM" || benimRolum === "YONETIM") && mulakatDegistir(a.id, "BM", a.mulakat_bm)}
                                    disabled={pending || !(benimRolum === "BM" || benimRolum === "YONETIM")}
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                      a.mulakat_bm === "YAPILDI" ? "bg-success-bg text-success"
                                      : a.mulakat_bm === "YAPILMADI" ? "bg-danger-bg text-danger"
                                      : "bg-gray-100 text-gray-400"
                                    } ${(benimRolum === "BM" || benimRolum === "YONETIM") ? "cursor-pointer hover:opacity-75" : "cursor-default"}`}
                                    title={(benimRolum === "BM" || benimRolum === "YONETIM") ? "Tıklayarak değiştir" : "Sadece BM veya Yönetim değiştirebilir"}
                                  >
                                    BM Mülakat: {a.mulakat_bm === "YAPILDI" ? "Yapıldı ✓" : a.mulakat_bm === "YAPILMADI" ? "Yapılmadı ✗" : "İşaretlenmedi"}
                                  </button>
                                  <button
                                    onClick={() => (benimRolum === "IK" || benimRolum === "YONETIM") && mulakatDegistir(a.id, "IK", a.mulakat_ik)}
                                    disabled={pending || !(benimRolum === "IK" || benimRolum === "YONETIM")}
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                      a.mulakat_ik === "YAPILDI" ? "bg-success-bg text-success"
                                      : a.mulakat_ik === "YAPILMADI" ? "bg-danger-bg text-danger"
                                      : "bg-gray-100 text-gray-400"
                                    } ${(benimRolum === "IK" || benimRolum === "YONETIM") ? "cursor-pointer hover:opacity-75" : "cursor-default"}`}
                                    title={(benimRolum === "IK" || benimRolum === "YONETIM") ? "Tıklayarak değiştir" : "Sadece İK veya Yönetim değiştirebilir"}
                                  >
                                    İK Mülakat: {a.mulakat_ik === "YAPILDI" ? "Yapıldı ✓" : a.mulakat_ik === "YAPILMADI" ? "Yapılmadı ✗" : "İşaretlenmedi"}
                                  </button>
                                </div>
                              )}
                              <button onClick={() => adayTarihceyiAcKapa(a.id)}
                                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                                  adayTarihceAcikId === a.id ? "bg-navy text-white border-navy" : "bg-gray-50 text-gray-500 border-gray-200 hover:border-navy hover:bg-white"
                                }`}>
                                <span>🕐 Süreç detayı</span>
                                <span className={`text-[7px] transition-transform ${adayTarihceAcikId === a.id ? "rotate-180" : ""}`}>▼</span>
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-400 font-mono text-[10px]">
                            {a.onay_tarihi ? new Date(a.onay_tarihi).toLocaleDateString("tr-TR") : "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">
                            {a.tc_kimlik_no ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">
                            {a.ise_baslama_tarihi ? new Date(a.ise_baslama_tarihi).toLocaleDateString("tr-TR") : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1.5 items-start">
                              {benKararVerebilirim && redModAdayId !== a.id && (
                                <>
                                  <button onClick={() => karar(a.id, "ONAY")} disabled={pending}
                                    className="bg-success text-white rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-50">Onayla</button>
                                  <button onClick={() => { setRedModAdayId(a.id); setRedAciklama(""); }} disabled={pending}
                                    className="bg-danger-bg text-danger border border-danger/30 rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-50">Reddet</button>
                                </>
                              )}
                              {redModAdayId === a.id && (
                                <div className="w-56 space-y-1">
                                  <textarea
                                    value={redAciklama}
                                    onChange={(e) => setRedAciklama(e.target.value)}
                                    placeholder="Red gerekçesi (en az 100 karakter)"
                                    rows={3}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-[10px]"
                                    autoFocus
                                  />
                                  <div className={`text-[9px] ${redAciklama.trim().length >= 100 ? "text-success" : "text-gray-400"}`}>
                                    {redAciklama.trim().length} / 100 karakter
                                  </div>
                                  <div className="flex gap-1.5">
                                    <button onClick={() => karar(a.id, "RED", redAciklama)} disabled={pending || redAciklama.trim().length < 100}
                                      className="bg-danger text-white rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-50">Reddi Onayla</button>
                                    <button onClick={() => { setRedModAdayId(null); setRedAciklama(""); }}
                                      className="text-[10px] text-gray-400">Vazgeç</button>
                                  </div>
                                </div>
                              )}
                              {a.durum === "ONAYLANDI" && (
                                <button onClick={() => ilerlet(a.id, "ON_GORUSME_PLANLANDI")} disabled={pending}
                                  className="bg-info text-white rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-50">Ön Görüşme</button>
                              )}
                              {a.durum === "ON_GORUSME_PLANLANDI" && (
                                <>
                                  <button onClick={() => ilerlet(a.id, "GORUSULDU_OLUMLU")} disabled={pending}
                                    className="bg-success text-white rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-50">Olumlu</button>
                                  <button onClick={() => ilerlet(a.id, "GORUSULDU_OLUMSUZ")} disabled={pending}
                                    className="bg-danger text-white rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-50">Olumsuz</button>
                                </>
                              )}
                              {a.durum === "GORUSULDU_OLUMLU" && (
                                <button onClick={() => { setIseAlHata(null); setIseAlAdayId(a.id); }} disabled={pending}
                                  className="bg-success text-white rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-50">İşe Al</button>
                              )}
                              {benSilebilirim && (
                                <button onClick={() => sil(a.id)} disabled={pending}
                                  className="bg-gray-100 text-gray-500 rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-50">Sil</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {adayTarihceAcikId === a.id && (
                          <tr className="bg-gray-50/50 border-t border-gray-100">
                            <td colSpan={11} className="px-6 py-3">
                              <div className="rounded-lg border border-gray-200 bg-white p-3 w-full">
                                <div className="text-[11px] font-semibold text-navy-3 mb-2">Süreç Tarihçesi — {a.ad_soyad}</div>
                                <SurecTarihce olaylar={adayTarihce} />
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {cvModalAday && (
        <CvModal
          adayId={cvModalAday.id}
          talepId={talep.id}
          mevcutCv={cvModalAday.cv}
          onClose={() => setCvModalAday(null)}
          onDone={() => { setCvModalAday(null); adaylariYukle(); }}
        />
      )}

      {ekleModalAcik && (
        <AdayEkleModal
          talepId={talep.id}
          onClose={() => setEkleModalAcik(false)}
          onDone={() => { setEkleModalAcik(false); adaylariYukle(); }}
        />
      )}

      {iseAlAdayId && (
        <IseAlModal
          pending={pending}
          hata={iseAlHata}
          onClose={() => { setIseAlAdayId(null); setIseAlHata(null); }}
          onConfirm={iseAlOnayla}
        />
      )}
    </>
  );
}
