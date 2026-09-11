"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function guncelleMagazaAdresKonum(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const magazaId = String(formData.get("magaza_id") ?? "");
  const adres = String(formData.get("adres") ?? "").trim();
  const konumLink = String(formData.get("konum_link") ?? "").trim();
  if (!magazaId) return { error: "Mağaza bulunamadı." };

  const { error } = await supabase
    .from("magazalar")
    .update({ adres: adres || null, konum_link: konumLink || null })
    .eq("id", magazaId);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/sistem");
  return {};
}

export async function ekleEgitimLinki(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const baslik = String(formData.get("baslik") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  if (!baslik || !link) return { error: "Başlık ve link zorunlu." };
  if (!/^https?:\/\//.test(link)) return { error: "Link http:// veya https:// ile başlamalı." };

  const { data: mevcutlar } = await supabase.from("egitim_linkleri").select("sira").order("sira", { ascending: false }).limit(1);
  const yeniSira = (mevcutlar?.[0]?.sira ?? 0) + 1;

  const { error } = await supabase.from("egitim_linkleri").insert({ baslik, link, sira: yeniSira });
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/sistem");
  return {};
}

export async function silEgitimLinki(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Eğitim bulunamadı." };

  const { error } = await supabase.from("egitim_linkleri").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/sistem");
  return {};
}
