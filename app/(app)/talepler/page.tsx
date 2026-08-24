import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RevizyonForm from "./RevizyonForm";

const TALEP_TURU_ETIKET: Record<string, string> = {
  ISE_ALIM: "İşe Alım",
  ISTEN_CIKARMA: "İşten Çıkarma",
  ROTASYON: "Rotasyon",
};

export default async function TaleplerimPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("kullanicilar").select("id").eq("email", user.email).single();
  if (!me) return null;

  const { data: talepler, error: talepHata } = await supabase
    .from("talepler")
    .select("id, talep_no, talep_turu, pozisyon_tipi, kisi_sayisi, durum, aktif_gonderim_no, created_at, magazalar!magaza_id(magaza_adi)")
    .eq("acan_kullanici_id", me.id)
    .order("created_at", { ascending: false });

  if (talepHata) {
    return <div className="text-xs text-danger">Hata: {talepHata.message}</div>;
  }

  const duraklamislar = (talepler ?? []).filter((t: any) => t.durum === "DURAKLADI");
  const redGerekceleri: Record<string, string> = {};
  for (const t of duraklamislar) {
    const { data: gonderim } = await supabase
      .from("talep_gonderimler")
      .select("id")
      .eq("talep_id", t.id)
      .eq("gonderim_no", t.aktif_gonderim_no)
      .single();
    if (gonderim) {
      const { data: redOnay } = await supabase
        .from("talep_onaylari")
        .select("aciklama, onaylayici_rol_baglami")
        .eq("gonderim_id", gonderim.id)
        .eq("karar", "RED")
        .limit(1)
        .single();
      if (redOnay) {
        redGerekceleri[t.id] = `${redOnay.onaylayici_rol_baglami}: ${redOnay.aciklama}`;
      }
    }
  }

  const durumRenk: Record<string, string> = {
    BEKLEMEDE: "text-accent",
    KABUL_EDILDI: "text-success",
    DURAKLADI: "text-danger",
    KAPANDI_RED: "text-danger",
    ISLEME_DEVAM: "text-info",
  };

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Taleplerim</div>
