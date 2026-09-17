"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { HASSAS_ALANLAR, KISITLANABILIR_ROLLER, type HassasAlan } from "@/lib/hassasVeri";

type Sonuc = { error?: string };

export type AlanGorunurlukAyari = { rol: string; alan: HassasAlan; gorebilir: boolean };

// Matris için tüm rol × alan kombinasyonlarını, DB'de kaydı olmayanlar
// varsayılan (gorebilir: true) ile birlikte döndürür.
export async function getAlanGorunurlukAyarlari(): Promise<AlanGorunurlukAyari[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return [];

  const { data } = await supabase.from("alan_gorunurluk_ayarlari").select("rol, alan, gorebilir");

  const sonuc: AlanGorunurlukAyari[] = [];
  KISITLANABILIR_ROLLER.forEach((rol) => {
    HASSAS_ALANLAR.forEach((alan) => {
      const kayit = (data ?? []).find((d: any) => d.rol === rol && d.alan === alan);
      sonuc.push({ rol, alan, gorebilir: kayit ? kayit.gorebilir : true });
    });
  });
  return sonuc;
}

export async function alanGorunurlukGuncelle(rol: string, alan: HassasAlan, gorebilir: boolean): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { error: "Sadece Yönetim değiştirebilir." };

  if (!(KISITLANABILIR_ROLLER as readonly string[]).includes(rol)) return { error: "Geçersiz rol." };
  if (!(HASSAS_ALANLAR as readonly string[]).includes(alan)) return { error: "Geçersiz alan." };

  const { error } = await supabase
    .from("alan_gorunurluk_ayarlari")
    .upsert({ rol, alan, gorebilir }, { onConflict: "rol,alan" });
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/kullanicilar");
  return {};
}
