"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SilmeSonuc = { basarili: boolean; silinen: number; hata?: string };

async function yonetimMi(): Promise<{ ok: boolean; hata?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, hata: "Giriş yapmalısınız." };
  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { ok: false, hata: "Bu işlem için Yönetim yetkisi gerekiyor." };
  return { ok: true };
}

export async function personelTumunuSil(): Promise<SilmeSonuc> {
  const yetki = await yonetimMi();
  if (!yetki.ok) return { basarili: false, silinen: 0, hata: yetki.hata };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("personel_topluca_sil");
  if (error) return { basarili: false, silinen: 0, hata: error.message };

  revalidatePath("/personel");
  revalidatePath("/norm");
  revalidatePath("/dashboard");
  revalidatePath("/ayarlar/veri-aktarim");
  revalidatePath("/ayarlar/magazalar");
  return { basarili: true, silinen: data ?? 0 };
}

export async function magazalarTumunuSil(): Promise<SilmeSonuc> {
  const yetki = await yonetimMi();
  if (!yetki.ok) return { basarili: false, silinen: 0, hata: yetki.hata };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("magazalar_topluca_sil");
  if (error) return { basarili: false, silinen: 0, hata: error.message };

  revalidatePath("/personel");
  revalidatePath("/norm");
  revalidatePath("/dashboard");
  revalidatePath("/raporlar");
  revalidatePath("/ayarlar/veri-aktarim");
  revalidatePath("/ayarlar/magazalar");
  return { basarili: true, silinen: data ?? 0 };
}

export async function performansKisiTumunuSil(): Promise<SilmeSonuc> {
  const yetki = await yonetimMi();
  if (!yetki.ok) return { basarili: false, silinen: 0, hata: yetki.hata };

  const supabase = createClient();
  const { count } = await supabase.from("performans_kisi_aylik").select("*", { count: "exact", head: true });
  const { error } = await supabase.from("performans_kisi_aylik").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return { basarili: false, silinen: 0, hata: error.message };

  await supabase.from("personel").update({
    performans_ortalama_hgo: null, performans_80_alti_sayisi: 0,
    performans_80_100_arasi_sayisi: 0, performans_100_ustu_sayisi: 0,
  }).neq("id", "00000000-0000-0000-0000-000000000000");

  revalidatePath("/personel");
  revalidatePath("/raporlar");
  revalidatePath("/dashboard");
  revalidatePath("/ayarlar/veri-aktarim");
  revalidatePath("/ayarlar/magazalar");
  return { basarili: true, silinen: count ?? 0 };
}

export async function performansMagazaTumunuSil(): Promise<SilmeSonuc> {
  const yetki = await yonetimMi();
  if (!yetki.ok) return { basarili: false, silinen: 0, hata: yetki.hata };

  const supabase = createClient();
  const { count } = await supabase.from("performans_magaza_aylik").select("*", { count: "exact", head: true });
  const { error } = await supabase.from("performans_magaza_aylik").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return { basarili: false, silinen: 0, hata: error.message };

  revalidatePath("/raporlar");
  revalidatePath("/dashboard");
  revalidatePath("/ayarlar/veri-aktarim");
  revalidatePath("/ayarlar/magazalar");
  return { basarili: true, silinen: count ?? 0 };
}
