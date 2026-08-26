"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/lib/email";

export async function yonlendirAday(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me || !["BM", "IK", "YONETIM"].includes(me.rol)) return { error: "Aday yönlendirme yetkiniz yok." };

  const talepId = String(formData.get("talep_id"));
  const adSoyad = String(formData.get("ad_soyad") ?? "").trim();
  const telefon = String(formData.get("telefon") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const cinsiyet = String(formData.get("cinsiyet") ?? "").trim();
  const cvYolu = String(formData.get("cv_yolu") ?? "").trim();

  if (!adSoyad) return { error: "Aday adı zorunlu." };
  if (!cvYolu) return { error: "CV yüklemeden aday eklenemez." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Geçerli bir e-posta adresi zorunlu." };

  const karariVerenRol = me.rol === "YONETIM" ? "BM_VE_IK" : (me.rol === "BM" ? "IK" : "BM");

  const { error } = await supabase.from("adaylar").insert({
    talep_id: talepId,
    ad_soyad: adSoyad,
    telefon: telefon || null,
    email: email,
    cinsiyet: cinsiyet || null,
    cv_drive_link: cvYolu,
    yonlendiren_kullanici_id: me.id,
    yonlendiren_rol: me.rol,
    karari_veren_rol: karariVerenRol,
    durum: "YONLENDIRILDI",
  });

  return { error: error?.message };
}

export async function guncelleAdayCv(formData: FormData) {
  const supabase = createClient();
  const adayId = String(formData.get("aday_id"));
  const cvYolu = String(formData.get("cv_yolu"));
  const { error } = await supabase.from("adaylar").update({ cv_drive_link: cvYolu, updated_at: new Date().toISOString() }).eq("id", adayId);
  return { error: error?.message };
}

export async function kararVerAday(formData: FormData) {
  const supabase = createClient();
  const adayId = String(formData.get("aday_id"));

  const { error } = await supabase.rpc("karar_ver_aday", {
    p_aday_id: adayId,
    p_karar: String(formData.get("karar")),
    p_aciklama: String(formData.get("aciklama") ?? "").trim() || null,
  });
  if (error) return { error: error.message };

  // Karar sonrası aday'ın güncel durumunu kontrol et — sadece nihai "ONAYLANDI" durumunda mail gönder
  // (Yönetim yönlendirmesinde ara adım / tek tarafın onayı bu koşulu tetiklemez).
  const { data: aday } = await supabase
    .from("adaylar")
    .select("ad_soyad, email, durum")
    .eq("id", adayId)
    .single();

  if (aday?.durum === "ONAYLANDI" && aday.email) {
    await sendMail({
      to: aday.email,
      subject: "İşe Alım Sürecinizde Onay Aldınız",
      text: `Sayın ${aday.ad_soyad},\n\nİşe alım sürecinizdeki başvurunuz onaylanmıştır. Süreç ilerledikçe sizinle iletişime geçilecektir.\n\nİyi günler dileriz.`,
    });
  }

  return { error: undefined };
}

export async function ilerletDurum(formData: FormData) {
  const supabase = createClient();
  const adayId = String(formData.get("aday_id"));
  const yeniDurum = String(formData.get("yeni_durum"));

  const { error } = await supabase.rpc("aday_durum_ilerlet", {
    p_aday_id: adayId,
    p_yeni_durum: yeniDurum,
    p_not: String(formData.get("not") ?? "").trim() || null,
    p_tc_kimlik_no: String(formData.get("tc_kimlik_no") ?? "").trim() || null,
    p_baslangic_tarihi: String(formData.get("baslangic_tarihi") ?? "").trim() || null,
  });
  // Sadece bu işlem talebin dışarıdaki "Tamamlandı" durumunu etkileyebildiği için sayfayı tazeliyoruz.
  revalidatePath("/talepler");

  if (error) return { error: error.message };

  if (yeniDurum === "ISE_ALINDI") {
    const { data: aday } = await supabase
      .from("adaylar")
      .select("ad_soyad, email")
      .eq("id", adayId)
      .single();

    if (aday?.email) {
      await sendMail({
        to: aday.email,
        subject: "İşe Alım Süreciniz Tamamlandı",
        text: `Sayın ${aday.ad_soyad},\n\nİşe alım süreciniz başarıyla tamamlanmıştır. Aramıza hoş geldiniz.\n\nİyi günler dileriz.`,
      });
    }
  }

  return { error: undefined };
}

export async function getAdaylarByTalep(talepId: string) {
  const supabase = createClient();
  const { data: adaylar, error } = await supabase
    .from("adaylar")
    .select("id, ad_soyad, telefon, email, cinsiyet, cv_drive_link, yonlendiren_rol, karari_veren_rol, durum, yonlendiren_kullanici_id, onay_bm, onay_ik, tc_kimlik_no, ise_baslama_tarihi")
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
  return { error: error?.message };
}
