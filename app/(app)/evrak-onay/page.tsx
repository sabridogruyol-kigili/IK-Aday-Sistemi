import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BELGE_LISTESI, belgeGorunurMu } from "@/lib/evrakSabitleri";
import EvrakOnayListesi from "./EvrakOnayListesi";

export default async function EvrakOnayPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || (me.rol !== "IK" && me.rol !== "YONETIM")) redirect("/dashboard");

  const { data: tokenlar } = await supabase
    .from("evrak_erisim_tokenlari")
    .select("personel_id, created_at, son_erisim_tarihi")
    .order("created_at", { ascending: false });

  const personelIdleri = Array.from(new Set((tokenlar ?? []).map((t) => t.personel_id)));
  if (personelIdleri.length === 0) {
    return <EvrakOnayListesi kisiler={[]} />;
  }

  const [{ data: personelListesi }, { data: bilgilerListesi }, { data: belgelerListesi }] = await Promise.all([
    supabase.from("personel").select("id, ad_soyad, guncel_unvan, magazalar!guncel_magaza_id(magaza_adi)").in("id", personelIdleri),
    supabase.from("personel_evrak_bilgileri").select("personel_id, cinsiyet, kvkk_onay_tarihi").in("personel_id", personelIdleri),
    supabase.from("personel_evrak_belgeleri").select("personel_id, belge_tipi, durum").in("personel_id", personelIdleri),
  ]);

  const kisiler = personelIdleri.map((pid) => {
    const personel = (personelListesi ?? []).find((p: any) => p.id === pid);
    const bilgi = (bilgilerListesi ?? []).find((b: any) => b.personel_id === pid);
    const kendiBelgeleri = (belgelerListesi ?? []).filter((b: any) => b.personel_id === pid);
    const cinsiyet = bilgi?.cinsiyet ?? null;
    const gerekliBelgeler = BELGE_LISTESI.filter((b) => !b.istegeBagli && belgeGorunurMu(b, cinsiyet));
    const onaylanan = gerekliBelgeler.filter((b) => kendiBelgeleri.find((k: any) => k.belge_tipi === b.id)?.durum === "ONAYLANDI").length;
    const reddedilen = kendiBelgeleri.filter((k: any) => k.durum === "REDDEDILDI").length;
    const incelemede = kendiBelgeleri.filter((k: any) => k.durum === "INCELEMEDE").length;

    let durumEtiket = "İşe Alım Onaylandı — Evrak Bekleniyor";
    if (onaylanan === gerekliBelgeler.length && gerekliBelgeler.length > 0) durumEtiket = "Tamamlandı";
    else if (reddedilen > 0) durumEtiket = "Eksik/Reddedilen Var";
    else if (incelemede > 0) durumEtiket = "İncelemede";

    return {
      personelId: pid,
      adSoyad: personel?.ad_soyad ?? "—",
      unvan: (personel as any)?.guncel_unvan ?? "—",
      magaza: (personel as any)?.magazalar?.magaza_adi ?? "—",
      tamamlanan: onaylanan,
      toplam: gerekliBelgeler.length,
      durumEtiket,
    };
  });

  return <EvrakOnayListesi kisiler={kisiler} />;
}
