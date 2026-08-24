"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function yonlendirAday(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me || !["BM", "IK"].includes(me.rol)) return { error: "Sadece BM veya İK aday yönlendirebilir." };

  const talepId = String(formData.get("talep_id"));
  const adSoyad = String(formData.get("ad_soyad") ?? "").trim();
  const cvLink = String(formData.get("cv_drive_link") ?? "").trim();
  if (!adSoyad) return { error: "Aday adı zorunlu." };

  const karariVerenRol = me.rol === "BM" ? "IK" : "BM";

  const { error } = await supabase.from("adaylar").insert({
    talep_id: talepId,
    ad_soyad: adSoyad,
    cv_drive_link: cvLink || null,
    yonlendiren_kullanici_id: me.id,
    yonlendiren_rol: me.rol,
    karari_veren_rol: karariVerenRol,
    durum: "YONLENDIRILDI",
  });

  revalidatePath("/adaylar");
  return { error: error?.message };
}

export async function kararVerAday(formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("karar_ver_aday", {
    p_aday_id: String(formData.get("aday_id")),
    p_karar: String(formData.get("karar")),
    p_aciklama: String(formData.get("aciklama") ?? "").trim() || null,
  });
  revalidatePath("/adaylar");
  return { error: error?.message };
}

export async function ilerletDurum(formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("aday_durum_ilerlet", {
    p_aday_id: String(formData.get("aday_id")),
    p_yeni_durum: String(formData.get("yeni_durum")),
    p_not: String(formData.get("not") ?? "").trim() || null,
    p_tc_kimlik_no: String(formData.get("tc_kimlik_no") ?? "").trim() || null,
  });
  revalidatePath("/adaylar");
  return { error: error?.message };
}
