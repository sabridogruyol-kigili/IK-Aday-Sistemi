"use client";

import { useState, useTransition } from "react";
import { getAdaylarByTalep, deleteAday, kararVerAday, ilerletDurum, yonlendirAday } from "../adaylar/actions";
import RevizyonForm from "./RevizyonForm";
import CvModal from "./CvModal";
import AdayStepper from "./AdayStepper";

const TALEP_TURU_ETIKET: Record<string, string> = { ISE_ALIM: "İşe Alım", ISTEN_CIKARMA: "İşten Çıkarma", ROTASYON: "Rotasyon" };
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

function yasHesapla(dogumTarihi: string | null) {
  if (!dogumTarihi) return "—";
  const dt = new Date(dogumTarihi);
  const bugun = new Date();
  let yas = bugun.getFullYear() - dt.getFullYear();
  const ay = bugun.getMonth() - dt.getMonth();
  if (ay < 0 || (ay === 0 && bugun.getDate() < dt.getDate())) yas--;
  return yas;
}

function inisiyal(adSoyad: string) {
  return adSoyad.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

type Talep = {
  id: string; talep_no: string; talep_turu: string; pozisyon_tipi: string | null; kisi_sayisi: number | null;
  durum: string; aktif_gonderim_no: number; created_at: string; magazalar: { magaza_adi: string } | null;
};
type Aday = {
  id: string; ad_soyad: string; dogum_tarihi: string | null; cinsiyet: string | null; cv_drive_link: string | null;
  yonlendiren_rol: string; karari_veren_rol: string; durum: string; yonlendiren_kullanici_id: string; onay_tarihi: string | null;
};

export default function TalepRow({
  talep, redGerekce, benimKullaniciId, benimRolum, baslangicAdaySayisi, acanAdi, acanRol, benimAcimMi,
}: {
  talep: Talep; redGerekce?: string; benimKullaniciId: string; benimRolum: string; baslangicAdaySayisi: number;
  acanAdi?: string; acanRol?: string; benimAcimMi: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [adayAcik, setAdayAcik] = useState(false);
  const [adaylar, setAdaylar] = useState<Aday[]>([]);
  const [adaySayisi, setAdaySayisi] = useState(baslangicAdaySayisi);
  const [cvModalAday, setCvModalAday] = useState<{ id: string; cv: string | null } | null>(null);
  const [yeniAdSoyad, setYeniAdSoyad] = useState("");
  const [yeniDogumTarihi, setYeniDogumTarihi] = useState("");
  const [yeniCinsiyet, setYeniCinsiyet] = useState("");
  const [hata, setHata] = useState<string | null>(null);

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

  function ekle() {
    if (!yeniAdSoyad.trim()) return;
    setHata(null);
    const fd = new FormData();
    fd.set("talep_id", talep.id);
    fd.set("ad_soyad", yeniAdSoyad);
    fd.set("dogum_tarihi", yeniDogumTarihi);
    fd.set("cinsiyet", yeniCinsiyet);
    startTransition(async () => {
      const res = await yonlendirAday(fd);
      if (res?.error) {
        setHata(res.error);
        return;
      }
      setYeniAdSoyad(""); setYeniDogumTarihi(""); setYeniCinsiyet("");
      adaylariYukle();
    });
  }

  function sil(adayId: string) {
    const fd = new FormData(); fd.set("aday_id", adayId);
    startTransition(async () => { await deleteAday(fd); adaylariYukle(); });
  }
  function karar(adayId: string, k: "ONAY" | "RED", aciklama?: string) {
    const fd = new FormData(); fd.set("aday_id", adayId); fd.set("karar", k); fd.set("aciklama", aciklama ?? "");
    startTransition(async () => { await kararVerAday(fd); adaylariYukle(); });
  }
  function ilerlet(adayId: string, yeniDurum: string, tcKimlik?: string) {
    const fd = new FormData(); fd.set("aday_id", adayId); fd.set("yeni_durum", yeniDurum);
    if (tcKimlik) fd.set("tc_kimlik_no", tcKimlik);
    startTransition(async () => { await ilerletDurum(fd); adaylariYukle(); });
  }

  const gosterAdayButonu = talep.talep_turu === "ISE_ALIM" && talep.durum === "KABUL_EDILDI";

  return (
    <>
      <tr className={`border-t border-gray-100 border-l-4 ${DURUM_KENARLIK[talep.durum] ?? "border-l-transparent"} align-top hover:bg-gray-50/50`}>
        <td className="px-3 py-2.5 font-mono text-navy-3">{talep.talep_no}</td>
        <td className="px-3 py-2.5
