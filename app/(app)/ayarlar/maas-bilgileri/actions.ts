"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function guncelleUnvanMaasi(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const unvan = String(formData.get("unvan") ?? "");
  const brutMaasHam = String(formData.get("brut_maas") ?? "").trim();
  if (!unvan) return { error: "Ünvan bulunamadı." };

  const brutMaas = brutMaasHam === "" ? null : Number(brutMaasHam.replace(",", "."));
  if (brutMaasHam !== "" && (brutMaas === null || isNaN(brutMaas) || brutMaas < 0)) {
    return { error: "Geçerli bir maaş tutarı girin." };
  }

  const { error } = await supabase
    .from("unvan_maas")
    .upsert({ unvan, brut_maas: brutMaas, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/maas-bilgileri");
  return {};
}

export async function guncelleIkIletisim(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const website = String(formData.get("ik_website") ?? "").trim();
  const email = String(formData.get("ik_email") ?? "").trim();
  const adres = String(formData.get("ik_adres") ?? "").trim();
  const calismaSaatleri = String(formData.get("ik_calisma_saatleri") ?? "").trim();

  if (!email) return { error: "E-posta zorunlu." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Geçerli bir e-posta adresi girin." };

  const { error } = await supabase
    .from("sistem_ayarlari")
    .update({ ik_website: website || null, ik_email: email, ik_adres: adres || null, ik_calisma_saatleri: calismaSaatleri || null })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/maas-bilgileri");
  return {};
}
export async function guncelleKidemTavani(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const tavanHam = String(formData.get("tavan") ?? "").trim().replace(",", ".");
  const tavan = Number(tavanHam);
  if (!tavanHam || isNaN(tavan) || tavan <= 0) return { error: "Geçerli bir tavan tutarı girin." };

  const { error } = await supabase
    .from("sistem_ayarlari")
    .update({ kidem_tazminati_tavani: tavan, guncelleme_tarihi: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/maas-bilgileri");
  return {};
}
