"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ProfilBilgisi = {
  ad_soyad: string;
  email: string;
  rol: string;
  dogum_tarihi: string | null;
  egitim_duzeyi: string | null;
  telefon: string | null;
  magazalar: string[];
};

export async function getBenimProfilim(): Promise<ProfilBilgisi | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase
    .from("kullanicilar")
    .select("id, ad_soyad, email, rol, dogum_tarihi, egitim_duzeyi, telefon")
    .eq("email", user.email)
    .single();
  if (!me) return null;

  let magazaAdlari: string[] = [];
  if (me.rol === "YONETIM") {
    magazaAdlari = ["Tüm Mağazalar"];
  } else {
    const { data: bolgeler } = await supabase.from("kullanici_bolge_atama").select("bolge_id").eq("kullanici_id", me.id);
    const bolgeIdleri = (bolgeler ?? []).map((b: any) => b.bolge_id);
    if (bolgeIdleri.length > 0) {
      const { data: magazalar } = await supabase.from("magazalar").select("magaza_adi").in("bolge_id", bolgeIdleri).eq("aktif", true).order("magaza_adi");
      magazaAdlari = (magazalar ?? []).map((m: any) => m.magaza_adi);
    }
  }

  return {
    ad_soyad: me.ad_soyad, email: me.email, rol: me.rol,
    dogum_tarihi: me.dogum_tarihi, egitim_duzeyi: me.egitim_duzeyi, telefon: me.telefon,
    magazalar: magazaAdlari,
  };
}

export async function profilimiGuncelle(veri: { dogum_tarihi: string | null; egitim_duzeyi: string | null; telefon: string | null }): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { error } = await supabase
    .from("kullanicilar")
    .update({ dogum_tarihi: veri.dogum_tarihi || null, egitim_duzeyi: veri.egitim_duzeyi || null, telefon: veri.telefon || null })
    .eq("email", user.email);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
}
