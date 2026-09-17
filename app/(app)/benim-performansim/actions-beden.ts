"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type BedenOlculeri = {
  beden_ceket: string | null;
  beden_pantolon: string | null;
  beden_gomlek: string | null;
  beden_tisort: string | null;
};

// Kişinin KENDİ beden ölçülerini görmesi/düzenlemesi — hassas veri yetki
// matrisinden bağımsızdır (kendi bilgin, denetim kaydı gerekmez).
export async function getKendiBedenOlculerim(): Promise<BedenOlculeri | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase.from("kullanicilar").select("personel_id").eq("email", user.email).single();
  if (!me?.personel_id) return null;

  const { data } = await supabase
    .from("personel")
    .select("beden_ceket, beden_pantolon, beden_gomlek, beden_tisort")
    .eq("id", me.personel_id)
    .single();

  return (data as BedenOlculeri) ?? null;
}

type Sonuc = { error?: string };

export async function bedenOlculeriniKaydet(formData: FormData): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("personel_id").eq("email", user.email).single();
  if (!me?.personel_id) return { error: "Bu kullanıcıya bağlı bir personel kaydı bulunamadı." };

  const ceket = String(formData.get("beden_ceket") ?? "").trim();
  const pantolon = String(formData.get("beden_pantolon") ?? "").trim();
  const gomlek = String(formData.get("beden_gomlek") ?? "").trim();
  const tisort = String(formData.get("beden_tisort") ?? "").trim();

  if (!ceket || !pantolon || !gomlek || !tisort) {
    return { error: "Ceket, pantolon, gömlek ve tişört bedeni — dördü de zorunludur." };
  }

  const { error } = await supabase
    .from("personel")
    .update({ beden_ceket: ceket, beden_pantolon: pantolon, beden_gomlek: gomlek, beden_tisort: tisort })
    .eq("id", me.personel_id);
  if (error) return { error: error.message };

  revalidatePath("/benim-performansim");
  return {};
}
