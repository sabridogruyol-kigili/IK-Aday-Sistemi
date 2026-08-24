"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function yonlendirAday(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me || !["BM", "IK", "YONETIM"].includes(me.rol)) return { error: "Aday yönlendirme yetkiniz yok." };

  const talepId = String(formData.get("talep_id"));
  const adSoyad = String(formData.get("ad_soyad") ?? "").trim();
  const dogumTarihi = String(formData.get("dogum_tarihi") ?? "").trim();
  const cinsiyet = String(formData.get("cinsiyet") ?? "").trim();
  const cvYolu = String(formData.get("cv_yolu") ?? "").trim();

  if (!adSoyad) return { error: "Aday adı zorunlu." };
  if (!cvYolu) return { error: "CV yüklemeden aday eklenemez." };

  const karariVerenRol = me.rol === "YONETIM" ? "BM_VE_IK" : (me.rol === "BM" ? "IK" : "BM");

  const { error } = await supabase.from("adaylar").insert({
    talep_id: talepId,
    ad_soyad: adSoyad,
    dogum_tarihi: dogumTarihi || null,
    cinsiyet: cinsiyet || null,
    cv_drive_link: cvYolu,
    yonlendiren_kullanici_id: me.id,
    yonlendiren_rol: me.rol,
    karari_veren_rol: karariVerenRol,
    durum: "YONLENDIRILDI",
  });

  revalidatePath("/talepler");
  revalidatePath("/adaylar");
  return { error: error?.message };
}

export async function guncelleAdayCv(formData: FormData) {
  const supabase = createClient();
  const adayId = String(formData.get("aday_id"));
  const cvYolu = String(formData.get("cv_yolu"));
  const { error } = await supabase.from("adaylar").update({ cv_drive_link: cvYolu, updated_at: new Date().toISOString() }).eq("id", adayId);
  revalidatePath("/talepler");
  return { error: error?.message };
}

export async function kararVerAday(formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("karar_ver_aday", {
    p_aday_id: String(formData.get("aday_id")),
    p_karar: String(formData.get("karar")),
    p_aciklama: String(formData.get("aciklama") ?? "").trim() || null,
  });
  revalidatePath("/talepler");
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
    p_baslangic_tarihi: String(formData.get("baslangic_tarihi") ?? "").trim() || null,
  });
  revalidatePath("/talepler");
  revalidatePath("/adaylar");
  return { error: error?.message };
}

export async function getAdaylarByTalep(talepId: string) {
  const supabase = createClient();
  const { data: adaylar, error } = await supabase
    .from("adaylar")
    .select("id, ad_soyad, dogum_tarihi, cinsiyet, cv_drive_link, yonlendiren_rol, karari_veren_rol, durum, yonlendiren_kullanici_id, onay_bm, onay_ik, tc_kimlik_no, ise_baslama_tarihi")
    .eq("talep_id", talepId)
    .order("created_at", { ascending: false });

  if (error || !adaylar) {
    return { data: [], error: error?.message };
  }

  const adayIdleri = adaylar.map((a) => a.id);
  const { data: gecmis } = await supabase
    .from("aday_surec_gecmisi")
    .select("aday_id, durum, created_at")
    .in("aday_id", adayIdleri)
    .eq("durum", "ONAYLANDI");

  const onayTarihiMap: Record<string, string> = {};
  (gecmis ?? []).forEach((g) => {
    if (!onayTarihiMap[g.aday_id]) onayTarihiMap[g.aday_id] = g.created_at;
  });

  const zenginlestirilmis = adaylar.map((a) => ({ ...a, onay_tarihi: onayTarihiMap[a.id] ?? null }));

  return { data: zenginlestirilmis, error: undefined };
}

export async function deleteAday(formData: FormData) {
  const supabase = createClient();
  const adayId = String(formData.get("aday_id"));
  const { error } = await supabase.from("adaylar").delete().eq("id", adayId);
  revalidatePath("/talepler");
  revalidatePath("/adaylar");
  return { error: error?.message };
}
