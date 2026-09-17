"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Sonuc = { error?: string };

export type KaraListeKaydi = {
  id: string;
  tc_kimlik_no: string;
  ad_soyad: string;
  aciklama: string;
  durum: "AKTIF" | "ONAY_BEKLIYOR" | "REDDEDILDI";
  ekleyen_rol: string;
  ekleyen_ad_soyad: string | null;
  onaylayan_ad_soyad: string | null;
  karar_tarihi: string | null;
  created_at: string;
};

// BM/İK/Yönetim çağırabilir. Yönetim eklerse anında AKTIF, BM/İK eklerse
// Yönetim onayı beklenen ONAY_BEKLIYOR durumunda oluşur.
export async function karaListeyeEkle(tcKimlikNo: string, adSoyad: string, aciklama: string): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me || !["BM", "IK", "YONETIM"].includes(me.rol)) return { error: "Bu işlem için yetkiniz yok." };

  const tc = tcKimlikNo.trim();
  if (!/^\d{11}$/.test(tc)) return { error: "TC Kimlik No 11 haneli olmalı." };
  if (!adSoyad.trim()) return { error: "Ad Soyad zorunlu." };
  if (aciklama.trim().length < 10) return { error: "Açıklama en az 10 karakter olmalı." };

  const { data: mevcut } = await supabase
    .from("kara_liste")
    .select("id, durum")
    .eq("tc_kimlik_no", tc)
    .in("durum", ["AKTIF", "ONAY_BEKLIYOR"])
    .maybeSingle();
  if (mevcut) {
    return { error: mevcut.durum === "AKTIF" ? "Bu TC zaten kara listede." : "Bu TC için zaten onay bekleyen bir kara liste kaydı var." };
  }

  const durum = me.rol === "YONETIM" ? "AKTIF" : "ONAY_BEKLIYOR";

  const { error } = await supabase.from("kara_liste").insert({
    tc_kimlik_no: tc,
    ad_soyad: adSoyad.trim(),
    aciklama: aciklama.trim(),
    durum,
    ekleyen_kullanici_id: me.id,
    ekleyen_rol: me.rol,
    ...(durum === "AKTIF" ? { onaylayan_kullanici_id: me.id, karar_tarihi: new Date().toISOString() } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath("/kara-liste");
  return {};
}

export async function karaListeOnayla(id: string): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };
  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { error: "Sadece Yönetim onaylayabilir." };

  const { error } = await supabase
    .from("kara_liste")
    .update({ durum: "AKTIF", onaylayan_kullanici_id: me.id, karar_tarihi: new Date().toISOString() })
    .eq("id", id)
    .eq("durum", "ONAY_BEKLIYOR");
  if (error) return { error: error.message };

  revalidatePath("/kara-liste");
  return {};
}

export async function karaListeReddet(id: string): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };
  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { error: "Sadece Yönetim reddedebilir." };

  const { error } = await supabase
    .from("kara_liste")
    .update({ durum: "REDDEDILDI", onaylayan_kullanici_id: me.id, karar_tarihi: new Date().toISOString() })
    .eq("id", id)
    .eq("durum", "ONAY_BEKLIYOR");
  if (error) return { error: error.message };

  revalidatePath("/kara-liste");
  return {};
}

// İşe Al modalında TC girilince kontrol için — AKTIF ya da ONAY_BEKLIYOR bir
// kayıt varsa döner (uyarı amaçlı, akışı bloklamaz).
export type KaraListeUyarisi = { aciklama: string; durum: "AKTIF" | "ONAY_BEKLIYOR"; ekleyen_rol: string; created_at: string };

export async function karaListeSorgula(tcKimlikNo: string): Promise<KaraListeUyarisi | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const tc = tcKimlikNo.trim();
  if (!/^\d{11}$/.test(tc)) return null;

  const { data } = await supabase
    .from("kara_liste")
    .select("aciklama, durum, ekleyen_rol, created_at")
    .eq("tc_kimlik_no", tc)
    .in("durum", ["AKTIF", "ONAY_BEKLIYOR"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as KaraListeUyarisi) ?? null;
}

export async function getKaraListe(): Promise<KaraListeKaydi[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("kara_liste")
    .select("id, tc_kimlik_no, ad_soyad, aciklama, durum, ekleyen_rol, created_at, karar_tarihi, ekleyen:ekleyen_kullanici_id(ad_soyad), onaylayan:onaylayan_kullanici_id(ad_soyad)")
    .order("created_at", { ascending: false });

  return (data ?? []).map((k: any) => ({
    id: k.id,
    tc_kimlik_no: k.tc_kimlik_no,
    ad_soyad: k.ad_soyad,
    aciklama: k.aciklama,
    durum: k.durum,
    ekleyen_rol: k.ekleyen_rol,
    ekleyen_ad_soyad: k.ekleyen?.ad_soyad ?? null,
    onaylayan_ad_soyad: k.onaylayan?.ad_soyad ?? null,
    karar_tarihi: k.karar_tarihi,
    created_at: k.created_at,
  }));
}
