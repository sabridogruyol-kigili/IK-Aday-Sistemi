"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { BELGE_LISTESI, tcKimlikGecerliMi, ibanGecerliMi, type BelgeTipi } from "@/lib/evrakSabitleri";
import { mailIskelet } from "@/lib/mailSablon";
import { sendMail } from "@/lib/email";
import { revalidatePath } from "next/cache";

// Aday portalında Supabase Auth kullanıcısı yok — link tek başına hiçbir
// veriye erişim sağlamaz. Önce e-posta doğrulanır (İşe Alım'da kayıtlı
// mailin AYNISI girilmeli), sonra o maile giden 6 haneli KOD girilir.
// Bu iki adımı geçmeden hiçbir veri okunamaz/yazılamaz — kod, her
// fonksiyonda ayrı ayrı, sunucu tarafında kontrol edilir.
async function tokenVeKodDogrula(token: string, kod: string): Promise<{ personelId: string } | { error: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("evrak_erisim_tokenlari")
    .select("personel_id, expires_at, dogrulama_kodu, dogrulama_kodu_son_tarih")
    .eq("token", token)
    .maybeSingle();
  if (!data) return { error: "Bu bağlantı geçersiz." };
  if (new Date(data.expires_at) < new Date()) return { error: "Bu bağlantının süresi dolmuş. İK'dan yeni bir bağlantı isteyin." };
  if (!data.dogrulama_kodu || !data.dogrulama_kodu_son_tarih) return { error: "Önce e-posta doğrulaması yapmalısınız." };
  if (new Date(data.dogrulama_kodu_son_tarih) < new Date()) return { error: "Doğrulama kodunun süresi dolmuş, tekrar e-posta doğrulaması yapın." };
  if (data.dogrulama_kodu !== kod.trim()) return { error: "Doğrulama kodu geçersiz." };

  await admin.from("evrak_erisim_tokenlari").update({ son_erisim_tarihi: new Date().toISOString() }).eq("token", token);
  return { personelId: data.personel_id };
}

// ADIM 1: E-posta doğrulama — girilen e-posta, bu token için İşe Alım
// sırasında kayıt edilen e-postayla (büyük/küçük harf duyarsız) eşleşmeli.
// Eşleşirse 6 haneli bir kod üretilip o adrese gönderilir.
export async function emailDogrula(token: string, girilenEmail: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("evrak_erisim_tokenlari")
    .select("email, expires_at, personel_id")
    .eq("token", token)
    .maybeSingle();

  if (!data) return { error: "Bu bağlantı geçersiz." };
  if (new Date(data.expires_at) < new Date()) return { error: "Bu bağlantının süresi dolmuş. İK'dan yeni bir bağlantı isteyin." };

  const kayitliEmail = (data.email ?? "").trim().toLowerCase();
  const girilen = girilenEmail.trim().toLowerCase();
  if (!kayitliEmail || kayitliEmail !== girilen) {
    return { error: "Girdiğiniz e-posta, işe alım sürecinde kayıtlı e-posta ile eşleşmiyor." };
  }

  const kod = String(Math.floor(100000 + Math.random() * 900000));
  const sonTarih = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin
    .from("evrak_erisim_tokenlari")
    .update({ dogrulama_kodu: kod, dogrulama_kodu_son_tarih: sonTarih })
    .eq("token", token);
  if (error) return { error: error.message };

  const { data: personel } = await admin.from("personel").select("ad_soyad").eq("id", data.personel_id).maybeSingle();

  const mailSonuc = await sendMail({
    to: girilenEmail,
    subject: "Evrak Portalı Doğrulama Kodunuz",
    text: `Sayın ${personel?.ad_soyad ?? ""},\n\nEvrak portalına giriş için doğrulama kodunuz: ${kod}\n\nBu kod 24 saat geçerlidir.`,
    html: mailIskelet({
      baslik: "Doğrulama Kodunuz",
      govdeHtml: `
        <p style="margin: 0 0 14px;">Sayın <strong>${personel?.ad_soyad ?? ""}</strong>,</p>
        <p style="margin: 0 0 18px;">Evrak portalına giriş yapmak için aşağıdaki kodu kullanın.</p>
        <div style="background-color: #FAFAF8; border-radius: 6px; padding: 18px; text-align: center; margin-bottom: 14px;">
          <div style="font-family: 'IBM Plex Mono', monospace; font-size: 28px; font-weight: 700; letter-spacing: 5px; color: #0F1B4D;">${kod}</div>
        </div>
        <p style="margin: 0; font-size: 12px; color: #8a8a86;">Bu kod 24 saat geçerlidir.</p>
      `,
    }),
  });
  if (mailSonuc.error) return { error: "Kod gönderilemedi: " + mailSonuc.error };

  return {};
}

// ADIM 2: Kod doğrulama — sadece kodun geçerli olup olmadığını kontrol eder,
// asıl veri erişimi her zaman tokenVeKodDogrula ile ayrıca yapılır.
export async function koduDogrula(token: string, kod: string): Promise<{ error?: string }> {
  const sonuc = await tokenVeKodDogrula(token, kod);
  if ("error" in sonuc) return sonuc;
  return {};
}

export type PortalVerisi = {
  ad_soyad: string;
  tc_kimlik_no: string | null;
  dogum_tarihi: string | null;
  telefon: string | null;
  email: string | null;
  bilgiler: any | null;
  belgeler: Record<BelgeTipi, { dosya_yollari: string[]; durum: string; red_nedeni: string | null; red_aciklama: string | null }>;
  ikWebsite: string | null;
  ikAdres: string | null;
  ikEmail: string | null;
  ikCalismaSaatleri: string | null;
  magazaAdi: string | null;
  magazaAdres: string | null;
  magazaKonumLink: string | null;
  egitimLinkleri: { id: string; baslik: string; link: string }[];
};

export async function getPortalVerisi(token: string, kod: string): Promise<PortalVerisi | { error: string }> {
  const dogrulama = await tokenVeKodDogrula(token, kod);
  if ("error" in dogrulama) return dogrulama;
  const admin = createAdminClient();

  const { data: personel } = await admin
    .from("personel")
    .select("ad_soyad, tc_kimlik_no, dogum_tarihi")
    .eq("id", dogrulama.personelId)
    .single();

  const { data: bilgiler } = await admin
    .from("personel_evrak_bilgileri")
    .select("*")
    .eq("personel_id", dogrulama.personelId)
    .maybeSingle();

  const { data: belgelerHam } = await admin
    .from("personel_evrak_belgeleri")
    .select("belge_tipi, dosya_yollari, durum, red_nedeni, red_aciklama")
    .eq("personel_id", dogrulama.personelId);

  const { data: ayarlar } = await admin
    .from("sistem_ayarlari")
    .select("ik_website, ik_email, ik_adres, ik_calisma_saatleri")
    .eq("id", 1)
    .maybeSingle();

  // Mağaza bilgisi: personel.tc_kimlik_no ile eşleşen orijinal aday kaydı
  // üzerinden, bağlı olduğu talebin mağazasına ulaşılır (aynı desen, mail
  // gönderiminde de kullanılıyor).
  let magazaAdi: string | null = null;
  let magazaAdres: string | null = null;
  let magazaKonumLink: string | null = null;
  if (personel?.tc_kimlik_no) {
    const { data: aday } = await admin
      .from("adaylar")
      .select("talep_id")
      .eq("tc_kimlik_no", personel.tc_kimlik_no)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (aday?.talep_id) {
      const { data: talep } = await admin
        .from("talepler")
        .select("magazalar!magaza_id(magaza_adi, adres, konum_link)")
        .eq("id", aday.talep_id)
        .maybeSingle();
      const magaza = (talep as any)?.magazalar;
      magazaAdi = magaza?.magaza_adi ?? null;
      magazaAdres = magaza?.adres ?? null;
      magazaKonumLink = magaza?.konum_link ?? null;
    }
  }

  const { data: egitimlerHam } = await admin.from("egitim_linkleri").select("id, baslik, link").order("sira");

  const belgeler: any = {};
  BELGE_LISTESI.forEach((b) => {
    const satir = (belgelerHam ?? []).find((s: any) => s.belge_tipi === b.id);
    belgeler[b.id] = satir
      ? { dosya_yollari: satir.dosya_yollari ?? [], durum: satir.durum, red_nedeni: satir.red_nedeni, red_aciklama: satir.red_aciklama }
      : { dosya_yollari: [], durum: "BEKLENIYOR", red_nedeni: null, red_aciklama: null };
  });

  return {
    ad_soyad: personel?.ad_soyad ?? "",
    tc_kimlik_no: personel?.tc_kimlik_no ?? null,
    dogum_tarihi: personel?.dogum_tarihi ?? null,
    telefon: bilgiler?.telefon ?? null,
    email: bilgiler?.email ?? null,
    bilgiler: bilgiler ?? null,
    ikWebsite: ayarlar?.ik_website ?? null,
    ikAdres: ayarlar?.ik_adres ?? null,
    ikEmail: ayarlar?.ik_email ?? null,
    ikCalismaSaatleri: ayarlar?.ik_calisma_saatleri ?? null,
    magazaAdi, magazaAdres, magazaKonumLink,
    egitimLinkleri: egitimlerHam ?? [],
    belgeler,
  };
}

export async function kvkkOnayla(token: string, kod: string): Promise<{ error?: string }> {
  const dogrulama = await tokenVeKodDogrula(token, kod);
  if ("error" in dogrulama) return dogrulama;
  const admin = createAdminClient();

  const simdi = new Date().toISOString();
  const { error } = await admin.from("personel_evrak_bilgileri").upsert({
    personel_id: dogrulama.personelId,
    kvkk_onay_tarihi: simdi,
    ozel_veri_onay_tarihi: simdi,
  });
  if (error) return { error: error.message };
  revalidatePath(`/evrak-portali/${token}`);
  return {};
}

export async function bilgileriKaydet(token: string, kod: string, formData: FormData): Promise<{ error?: string }> {
  const dogrulama = await tokenVeKodDogrula(token, kod);
  if ("error" in dogrulama) return dogrulama;
  const admin = createAdminClient();

  const iban = String(formData.get("iban") ?? "").trim().toUpperCase();
  if (iban && !ibanGecerliMi(iban)) return { error: "IBAN geçerli değil — TR ile başlayan 26 karakter olmalı." };

  const alanlar = [
    "cinsiyet", "medeni_hal", "il", "ilce", "mahalle", "cadde", "sokak",
    "site_adi", "blok_no", "apt_adi", "bina_no", "daire_no",
    "il2", "ilce2", "mahalle2", "cadde2", "sokak2", "site_adi2", "blok_no2", "apt_adi2", "bina_no2", "daire_no2",
  ];
  const guncelleme: any = { personel_id: dogrulama.personelId, iban: iban || null };
  alanlar.forEach((a) => { guncelleme[a] = String(formData.get(a) ?? "").trim() || null; });
  guncelleme.emekli = formData.get("emekli") === "true";
  guncelleme.engelli = formData.get("engelli") === "true";
  guncelleme.ikinci_adres_var = formData.get("ikinci_adres_var") === "true";
  guncelleme.saglik_rapor_tipi = String(formData.get("saglik_rapor_tipi") ?? "") || null;
  guncelleme.updated_at = new Date().toISOString();

  const { error } = await admin.from("personel_evrak_bilgileri").upsert(guncelleme);
  if (error) return { error: error.message };
  revalidatePath(`/evrak-portali/${token}`);
  return {};
}

export async function belgeYukle(token: string, kod: string, formData: FormData): Promise<{ error?: string }> {
  const dogrulama = await tokenVeKodDogrula(token, kod);
  if ("error" in dogrulama) return dogrulama;
  const admin = createAdminClient();

  const belgeTipi = String(formData.get("belge_tipi") ?? "") as BelgeTipi;
  const dosyalar = formData.getAll("dosyalar") as File[];
  if (dosyalar.length === 0) return { error: "Dosya seçilmedi." };

  const yuklenenYollar: string[] = [];
  for (const dosya of dosyalar) {
    if (dosya.size === 0) continue;
    const uzanti = dosya.name.split(".").pop() ?? "dat";
    const dosyaYolu = `${dogrulama.personelId}/${belgeTipi}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${uzanti}`;
    const { error: yuklemeHata } = await admin.storage.from("evrak-dosyalari").upload(dosyaYolu, dosya, { contentType: dosya.type });
    if (yuklemeHata) return { error: `Yükleme başarısız: ${yuklemeHata.message}` };
    yuklenenYollar.push(dosyaYolu);
  }
  if (yuklenenYollar.length === 0) return { error: "Geçerli dosya bulunamadı." };

  const { error } = await admin.from("personel_evrak_belgeleri").upsert({
    personel_id: dogrulama.personelId,
    belge_tipi: belgeTipi,
    dosya_yollari: yuklenenYollar,
    durum: "INCELEMEDE",
    red_nedeni: null,
    red_aciklama: null,
    yukleme_tarihi: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "personel_id,belge_tipi" });

  if (error) return { error: error.message };
  revalidatePath(`/evrak-portali/${token}`);
  return {};
}
