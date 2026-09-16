"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SistemNotu = {
  id: string;
  metin: string;
  durum: "BEKLEMEDE" | "TAMAMLANDI";
  onem: "AZ" | "ORTA" | "COK";
  olusturan_ad_soyad: string;
  guncelleyen_ad_soyad: string | null;
  created_at: string;
  updated_at: string;
};

async function yetkiKontrol() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, me: null };
  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  return { supabase, me };
}

export async function getSistemNotlari(): Promise<SistemNotu[]> {
  const { supabase, me } = await yetkiKontrol();
  if (!me || me.rol !== "YONETIM") return [];

  const { data, error } = await supabase
    .from("sistem_notlari")
    .select("id, metin, durum, onem, created_at, updated_at, olusturan:kullanicilar!olusturan_kullanici_id(ad_soyad), guncelleyen:kullanicilar!guncelleyen_kullanici_id(ad_soyad)")
    .order("durum", { ascending: true })
    .order("onem", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return (data as any[]).map((n) => ({
    id: n.id, metin: n.metin, durum: n.durum, onem: n.onem, created_at: n.created_at, updated_at: n.updated_at,
    olusturan_ad_soyad: n.olusturan?.ad_soyad ?? "—",
    guncelleyen_ad_soyad: n.guncelleyen?.ad_soyad ?? null,
  }));
}

export async function sistemNotuEkle(metin: string, onem: "AZ" | "ORTA" | "COK" = "ORTA"): Promise<{ error?: string }> {
  const { supabase, me } = await yetkiKontrol();
  if (!me || me.rol !== "YONETIM") return { error: "Sadece Yönetim not ekleyebilir." };

  const temiz = metin.trim();
  if (!temiz) return { error: "Not boş olamaz." };

  const { error } = await supabase.from("sistem_notlari").insert({ metin: temiz, onem, olusturan_kullanici_id: me.id });
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/sistem-notlari");
  return {};
}

export async function sistemNotuOnemDegistir(id: string, onem: "AZ" | "ORTA" | "COK"): Promise<{ error?: string }> {
  const { supabase, me } = await yetkiKontrol();
  if (!me || me.rol !== "YONETIM") return { error: "Sadece Yönetim değiştirebilir." };

  const { error } = await supabase.from("sistem_notlari").update({ onem, guncelleyen_kullanici_id: me.id, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/sistem-notlari");
  return {};
}

export async function sistemNotuDurumDegistir(id: string, durum: "BEKLEMEDE" | "TAMAMLANDI"): Promise<{ error?: string }> {
  const { supabase, me } = await yetkiKontrol();
  if (!me || me.rol !== "YONETIM") return { error: "Sadece Yönetim değiştirebilir." };

  const { error } = await supabase.from("sistem_notlari").update({ durum, guncelleyen_kullanici_id: me.id, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/sistem-notlari");
  return {};
}

export async function sistemNotuDuzenle(id: string, metin: string): Promise<{ error?: string }> {
  const { supabase, me } = await yetkiKontrol();
  if (!me || me.rol !== "YONETIM") return { error: "Sadece Yönetim düzenleyebilir." };

  const temiz = metin.trim();
  if (!temiz) return { error: "Not boş olamaz." };

  const { error } = await supabase.from("sistem_notlari").update({ metin: temiz, guncelleyen_kullanici_id: me.id, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/sistem-notlari");
  return {};
}

export async function sistemNotuSil(id: string): Promise<{ error?: string }> {
  const { supabase, me } = await yetkiKontrol();
  if (!me || me.rol !== "YONETIM") return { error: "Sadece Yönetim silebilir." };

  const { error } = await supabase.from("sistem_notlari").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/sistem-notlari");
  return {};
}
