"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/lib/email";
import { uygulamaUrl } from "@/lib/appUrl";

export type EvrakDetay = {
  cinsiyet: string | null;
  belgeler: { id: string; belge_tipi: string; dosya_yollari: string[]; durum: string; red_nedeni: string | null; red_aciklama: string | null; ik_notu: string | null }[];
};

export async function getEvrakDetay(personelId: string): Promise<EvrakDetay | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: bilgi }, { data: belgeler }] = await Promise.all([
    supabase.from("personel_evrak_bilgileri").select("cinsiyet").eq("personel_id", personelId).maybeSingle(),
    supabase.from("personel_evrak_belgeleri").select("id, belge_tipi, dosya_yollari, durum, red_nedeni, red_aciklama, ik_notu").eq("personel_id", personelId),
  ]);

  return {
    cinsiyet: bilgi?.cinsiyet ?? null,
    belgeler: belgeler ?? [],
  };
}

export async function belgeKararVer(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me || (me.rol !== "IK" && me.rol !== "YONETIM")) return { error: "Bu işlem için yetkiniz yok." };

  const belgeId = String(formData.get("belge_id"));
  const karar = String(formData.get("karar")); // ONAYLANDI | REDDEDILDI
  const redNedeni = String(formData.get("red_nedeni") ?? "").trim() || null;
  const redAciklama = String(formData.get("red_aciklama") ?? "").trim() || null;
  const ikNotu = String(formData.get("ik_notu") ?? "").trim() || null;

  if (karar === "REDDEDILDI" && !redNedeni) return { error: "Red nedeni seçilmeli." };
  if (redNedeni === "Diğer" && !redAciklama) return { error: "\"Diğer\" seçildiğinde açıklama zorunlu." };

  const { error } = await supabase
    .from("personel_evrak_belgeleri")
    .update({
      durum: karar,
      red_nedeni: karar === "REDDEDILDI" ? redNedeni : null,
      red_aciklama: karar === "REDDEDILDI" ? redAciklama : null,
      ik_notu: ikNotu,
      karar_tarihi: new Date().toISOString(),
      karar_veren_kullanici_id: me.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", belgeId);

  if (error) return { error: error.message };
  revalidatePath("/evrak-onay");
  return {};
}

export async function getBelgeSignedUrl(dosyaYolu: string): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data, error } = await supabase.storage.from("evrak-dosyalari").createSignedUrl(dosyaYolu, 300);
  if (error || !data) return { error: "Dosya bağlantısı üretilemedi." };
  return { url: data.signedUrl };
}

export async function hatirlatmaGonder(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const personelId = String(formData.get("personel_id"));

  const { data: token } = await supabase
    .from("evrak_erisim_tokenlari")
    .select("token, email")
    .eq("personel_id", personelId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!token) return { error: "Bu personel için evrak bağlantısı bulunamadı." };

  const { data: personel } = await supabase.from("personel").select("ad_soyad").eq("id", personelId).maybeSingle();

  await supabase
    .from("evrak_erisim_tokenlari")
    .update({ expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("token", token.token);

  if (token.email) {
    const link = `${uygulamaUrl()}/evrak-portali/${token.token}`;
    await sendMail({
      to: token.email,
      subject: "İşe Giriş Evraklarınız — Hatırlatma",
      text: `Sayın ${personel?.ad_soyad ?? ""},\n\nİşe giriş evrak sürecinizde eksik belgeler bulunuyor. Aşağıdaki bağlantıdan devam edebilirsiniz:\n\n${link}\n\nİyi günler dileriz.`,
    }).catch(() => {});
  }

  revalidatePath("/evrak-onay");
  return {};
}
