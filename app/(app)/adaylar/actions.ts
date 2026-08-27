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

export async function mulakatIsaretle(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return { error: "Kullanıcı bulunamadı." };

  const adayId = String(formData.get("aday_id"));
  const rol = String(formData.get("rol"));
  const durum = String(formData.get("durum"));

  if (!["BM", "IK"].includes(rol)) return { error: "Geçersiz rol." };
  if (!["YAPILDI", "YAPILMADI"].includes(durum)) return { error: "Geçersiz mülakat durumu." };
  if (me.rol !== rol && me.rol !== "YONETIM") {
    return { error: `Bu mülakat durumunu sadece ${rol} veya Yönetim işaretleyebilir.` };
  }

  const kolon = rol === "BM" ? "mulakat_bm" : "mulakat_ik";
  const { error } = await supabase.from("adaylar").update({ [kolon]: durum, updated_at: new Date().toISOString() }).eq("id", adayId);
  if (error) return { error: error.message };

  await supabase.from("aday_surec_gecmisi").insert({
    aday_id: adayId,
    durum: `MULAKAT_${rol}_${durum}`,
    degistiren_kullanici_id: me.id,
  });

  revalidatePath("/talepler");
  return { error: undefined };
}

type KararSonuc = { error?: string; aday?: { durum: string; onay_bm: string | null; onay_ik: string | null } };

export async function kararVerAday(formData: FormData): Promise<KararSonuc> {
  const supabase = createClient();
  const adayId = String(formData.get("aday_id"));

  const { error } = await supabase.rpc("karar_ver_aday", {
    p_aday_id: adayId,
    p_karar: String(formData.get("karar")),
    p_aciklama: String(formData.get("aciklama") ?? "").trim() || null,
  });
  if (error) return { error: error.message };

  const { data: aday } = await supabase
    .from("adaylar")
    .select("ad_soyad, email, durum, onay_bm, onay_ik")
    .eq("id", adayId)
    .single();

  // Mail gönderimini beklemeden (arka planda) tetikle — SMTP round-trip'i kullanıcıyı bekletmesin.
  if (aday?.durum === "ONAYLANDI" && aday.email) {
    sendMail({
      to: aday.email,
      subject: "İşe Alım Sürecinizde Onay Aldınız",
      text: `Sayın ${aday.ad_soyad},\n\nİşe alım sürecinizdeki başvurunuz onaylanmıştır. Süreç ilerledikçe sizinle iletişime geçilecektir.\n\nİyi günler dileriz.`,
    }).catch(() => {});
  }

  return { error: undefined, aday: aday ? { durum: aday.durum, onay_bm: aday.onay_bm, onay_ik: aday.onay_ik } : undefined };
}

type IlerletSonuc = { error?: string; aday?: { durum: string; tc_kimlik_no: string | null; ise_baslama_tarihi: string | null } };

export async function ilerletDurum(formData: FormData): Promise<IlerletSonuc> {
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
  revalidatePath("/talepler");

  if (error) return { error: error.message };

  const { data: aday } = await supabase
    .from("adaylar")
    .select("ad_soyad, email, durum, tc_kimlik_no, ise_baslama_tarihi")
    .eq("id", adayId)
    .single();

  // Mail gönderimini beklemeden (arka planda) tetikle — SMTP round-trip'i kullanıcıyı bekletmesin.
  if (yeniDurum === "ISE_ALINDI" && aday?.email) {
    sendMail({
      to: aday.email,
      subject: "İşe Alım Süreciniz Tamamlandı",
      text: `Sayın ${aday.ad_soyad},\n\nİşe alım süreciniz başarıyla tamamlanmıştır. Aramıza hoş geldiniz.\n\nİyi günler dileriz.`,
    }).catch(() => {});
  }

  return {
    error: undefined,
    aday: aday ? { durum: aday.durum, tc_kimlik_no: aday.tc_kimlik_no, ise_baslama_tarihi: aday.ise_baslama_tarihi } : undefined,
  };
}

export async function getAdaylarByTalep(talepId: string) {
  const supabase = createClient();
  const { data: adaylar, error } = await supabase
    .from("adaylar")
    .select("id, ad_soyad, telefon, email, cinsiyet, cv_drive_link, yonlendiren_rol, karari_veren_rol, durum, yonlendiren_kullanici_id, onay_bm, onay_ik, mulakat_bm, mulakat_ik, tc_kimlik_no, ise_baslama_tarihi")
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

// ============================================================
// Süreç Tarihçesi — geçmiş + mevcut + gelecek adımları tek şablonda üretir.
// Her adımın "durum" alanı: TAMAMLANDI (yeşil/kırmızı, gerçekleşti) | MEVCUT (mavi, şu an bekleniyor) | GELECEK (gri, henüz sırası gelmedi)
// ============================================================
export type SurecAdimi = {
  baslik: string;
  tarih: string | null;
  detay?: string | null;
  durum: "TAMAMLANDI_OLUMLU" | "TAMAMLANDI_OLUMSUZ" | "TAMAMLANDI_NOTR" | "MEVCUT" | "GELECEK";
};

function enSonTarih(gecmis: any[], durumlar: string[]): string | null {
  const eslesen = gecmis.filter((g) => durumlar.includes(g.durum));
  if (eslesen.length === 0) return null;
  return eslesen[eslesen.length - 1].created_at;
}

export async function getAdaySurecGecmisi(adayId: string): Promise<{ data: SurecAdimi[]; error?: string }> {
  const supabase = createClient();

  const { data: aday, error: adayHata } = await supabase
    .from("adaylar")
    .select("ad_soyad, created_at, yonlendiren_rol, karari_veren_rol, durum, onay_bm, onay_ik, mulakat_bm, mulakat_ik")
    .eq("id", adayId)
    .single();
  if (adayHata || !aday) return { data: [], error: adayHata?.message ?? "Aday bulunamadı." };

  const { data: gecmis } = await supabase
    .from("aday_surec_gecmisi")
    .select("durum, aciklama, created_at")
    .eq("aday_id", adayId)
    .order("created_at");
  const g = gecmis ?? [];

  const adimlar: SurecAdimi[] = [];

  adimlar.push({ tarih: aday.created_at, baslik: `Aday Eklendi — ${aday.yonlendiren_rol}`, durum: "TAMAMLANDI_NOTR" });

  const durumSirasi = ["YONLENDIRILDI", "ONAYLANDI", "REDDEDILDI", "ON_GORUSME_PLANLANDI", "GORUSULDU_OLUMLU", "GORUSULDU_OLUMSUZ", "ISE_ALINDI"];
  const mevcutIndex = durumSirasi.indexOf(aday.durum);

  function mulakatAdimi(rol: "BM" | "IK", deger: string | null) {
    const tarih = enSonTarih(g, [`MULAKAT_${rol}_YAPILDI`, `MULAKAT_${rol}_YAPILMADI`]);
    if (deger === "YAPILDI") adimlar.push({ tarih, baslik: `Mülakat (${rol}) — Yapıldı`, durum: "TAMAMLANDI_OLUMLU" });
    else if (deger === "YAPILMADI") adimlar.push({ tarih, baslik: `Mülakat (${rol}) — Yapılmadı`, durum: "TAMAMLANDI_OLUMSUZ" });
    else adimlar.push({ tarih: null, baslik: `Mülakat (${rol})`, durum: aday.durum === "YONLENDIRILDI" ? "MEVCUT" : "GELECEK" });
  }

  if (aday.durum === "REDDEDILDI" || aday.durum === "ONAYLANDI" || aday.durum === "YONLENDIRILDI") {
    if (aday.karari_veren_rol === "BM_VE_IK") {
      mulakatAdimi("BM", aday.mulakat_bm);
      mulakatAdimi("IK", aday.mulakat_ik);
      const bmTarih = enSonTarih(g, ["ARA_KARAR_BM_ONAY", "ARA_KARAR_BM_RED"]);
      const ikTarih = enSonTarih(g, ["ARA_KARAR_IK_ONAY", "ARA_KARAR_IK_RED"]);
      adimlar.push({
        tarih: bmTarih,
        baslik: aday.onay_bm ? `BM Kararı — ${aday.onay_bm === "ONAY" ? "Onayladı" : "Reddetti"}` : "BM Kararı",
        durum: aday.onay_bm === "ONAY" ? "TAMAMLANDI_OLUMLU" : aday.onay_bm === "RED" ? "TAMAMLANDI_OLUMSUZ" : "MEVCUT",
      });
      adimlar.push({
        tarih: ikTarih,
        baslik: aday.onay_ik ? `İK Kararı — ${aday.onay_ik === "ONAY" ? "Onayladı" : "Reddetti"}` : "İK Kararı",
        durum: aday.onay_ik === "ONAY" ? "TAMAMLANDI_OLUMLU" : aday.onay_ik === "RED" ? "TAMAMLANDI_OLUMSUZ" : "MEVCUT",
      });
    } else {
      const rol = aday.karari_veren_rol as "BM" | "IK";
      mulakatAdimi(rol, rol === "BM" ? aday.mulakat_bm : aday.mulakat_ik);
      const kararTarihi = enSonTarih(g, ["ONAYLANDI", "REDDEDILDI"]);
      adimlar.push({
        tarih: aday.durum === "YONLENDIRILDI" ? null : kararTarihi,
        baslik: aday.durum === "ONAYLANDI" ? `Karar (${rol}) — Onayladı` : aday.durum === "REDDEDILDI" ? `Karar (${rol}) — Reddetti` : `Karar (${rol})`,
        durum: aday.durum === "ONAYLANDI" ? "TAMAMLANDI_OLUMLU" : aday.durum === "REDDEDILDI" ? "TAMAMLANDI_OLUMSUZ" : "MEVCUT",
      });
    }
  } else {
    // Karar aşaması geride kaldı (ön görüşme veya sonrasına geçilmiş) — özet tek satır olarak göster
    adimlar.push({ tarih: enSonTarih(g, ["ONAYLANDI"]), baslik: "Karar — Onaylandı", durum: "TAMAMLANDI_OLUMLU" });
  }

  if (aday.durum === "REDDEDILDI") {
    return { data: adimlar };
  }

  // Ön Görüşme
  adimlar.push({
    tarih: enSonTarih(g, ["ON_GORUSME_PLANLANDI"]),
    baslik: "Ön Görüşme Planlandı",
    durum: mevcutIndex > durumSirasi.indexOf("ON_GORUSME_PLANLANDI") ? "TAMAMLANDI_NOTR"
      : aday.durum === "ON_GORUSME_PLANLANDI" ? "TAMAMLANDI_NOTR"
      : aday.durum === "ONAYLANDI" ? "MEVCUT" : "GELECEK",
  });

  // Görüşüldü
  const gorusuldu = aday.durum === "GORUSULDU_OLUMLU" || aday.durum === "GORUSULDU_OLUMSUZ" || aday.durum === "ISE_ALINDI";
  adimlar.push({
    tarih: enSonTarih(g, ["GORUSULDU_OLUMLU", "GORUSULDU_OLUMSUZ"]),
    baslik: aday.durum === "GORUSULDU_OLUMSUZ" ? "Görüşüldü — Olumsuz" : gorusuldu ? "Görüşüldü — Olumlu" : "Görüşüldü",
    durum: aday.durum === "GORUSULDU_OLUMLU" || aday.durum === "ISE_ALINDI" ? "TAMAMLANDI_OLUMLU"
      : aday.durum === "GORUSULDU_OLUMSUZ" ? "TAMAMLANDI_OLUMSUZ"
      : aday.durum === "ON_GORUSME_PLANLANDI" ? "MEVCUT" : "GELECEK",
  });

  if (aday.durum === "GORUSULDU_OLUMSUZ") {
    return { data: adimlar };
  }

  // İşe Alındı
  adimlar.push({
    tarih: enSonTarih(g, ["ISE_ALINDI"]),
    baslik: "İşe Alındı",
    durum: aday.durum === "ISE_ALINDI" ? "TAMAMLANDI_OLUMLU" : aday.durum === "GORUSULDU_OLUMLU" ? "MEVCUT" : "GELECEK",
  });

  return { data: adimlar };
}
