"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/lib/email";
import { uygulamaUrl } from "@/lib/appUrl";

export type EvrakDetay = {
  ad_soyad: string;
  email: string | null;
  telefon: string | null;
  cinsiyet: string | null;
  dogum_tarihi: string | null;
  medeni_hal: string | null;
  iban: string | null;
  belgeler: { id: string; belge_tipi: string; dosya_yollari: string[]; durum: string; red_nedeni: string | null; red_aciklama: string | null; ik_notu: string | null }[];
};

export async function getEvrakDetay(personelId: string): Promise<EvrakDetay | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: personel }, { data: bilgi }, { data: token }, { data: belgeler }] = await Promise.all([
    supabase.from("personel").select("ad_soyad, tc_kimlik_no, cinsiyet, dogum_tarihi").eq("id", personelId).maybeSingle(),
    supabase.from("personel_evrak_bilgileri").select("cinsiyet, medeni_hal, iban").eq("personel_id", personelId).maybeSingle(),
    supabase.from("evrak_erisim_tokenlari").select("email").eq("personel_id", personelId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("personel_evrak_belgeleri").select("id, belge_tipi, dosya_yollari, durum, red_nedeni, red_aciklama, ik_notu").eq("personel_id", personelId),
  ]);

  // personel.cinsiyet/dogum_tarihi genelde Personel Şablonu importundan gelir;
  // "İşe Al" ile oluşan yeni kayıtlarda boş olabilir — bu durumda, aynı TC
  // Kimlik No'ya sahip orijinal aday kaydındaki (aday eklerken girilen)
  // değerlere geri dönülür.
  let cinsiyet = personel?.cinsiyet ?? bilgi?.cinsiyet ?? null;
  let dogumTarihi = personel?.dogum_tarihi ?? null;
  if ((!cinsiyet || !dogumTarihi) && personel?.tc_kimlik_no) {
    const { data: aday } = await supabase
      .from("adaylar")
      .select("cinsiyet, dogum_tarihi")
      .eq("tc_kimlik_no", personel.tc_kimlik_no)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    cinsiyet = cinsiyet ?? aday?.cinsiyet ?? null;
    dogumTarihi = dogumTarihi ?? aday?.dogum_tarihi ?? null;
  }

  return {
    ad_soyad: personel?.ad_soyad ?? "",
    email: token?.email ?? null,
    telefon: null,
    cinsiyet,
    dogum_tarihi: dogumTarihi,
    medeni_hal: bilgi?.medeni_hal ?? null,
    iban: bilgi?.iban ?? null,
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
