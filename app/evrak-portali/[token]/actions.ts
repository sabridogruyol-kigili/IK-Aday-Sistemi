"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { BELGE_LISTESI, tcKimlikGecerliMi, ibanGecerliMi, type BelgeTipi } from "@/lib/evrakSabitleri";
import { revalidatePath } from "next/cache";

// Aday portalında Supabase Auth kullanıcısı yok — her işlem, önce token'ı
// doğrulayıp personel_id'yi bulur, sonra service role ile (RLS'siz) çalışır.
// Bu yüzden token doğrulaması burada, YALNIZCA bu dosyanın fonksiyonlarında
// yapılır; başka hiçbir yol bu tablolara erişemez.
async function tokenDogrula(token: string): Promise<{ personelId: string } | { error: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("evrak_erisim_tokenlari")
    .select("personel_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return { error: "Bu bağlantı geçersiz." };
  if (new Date(data.expires_at) < new Date()) return { error: "Bu bağlantının süresi dolmuş. İK'dan yeni bir bağlantı isteyin." };

  await admin.from("evrak_erisim_tokenlari").update({ son_erisim_tarihi: new Date().toISOString() }).eq("token", token);
  return { personelId: data.personel_id };
}

export type PortalVerisi = {
  ad_soyad: string;
  tc_kimlik_no: string | null;
  dogum_tarihi: string | null;
  telefon: string | null;
  email: string | null;
  bilgiler: any | null;
  belgeler: Record<BelgeTipi, { dosya_yollari: string[]; durum: string; red_nedeni: string | null; red_aciklama: string | null }>;
};

export async function getPortalVerisi(token: string): Promise<PortalVerisi | { error: string }> {
  const dogrulama = await tokenDogrula(token);
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
    belgeler,
  };
}

export async function kvkkOnayla(token: string): Promise<{ error?: string }> {
  const dogrulama = await tokenDogrula(token);
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

export async function bilgileriKaydet(token: string, formData: FormData): Promise<{ error?: string }> {
  const dogrulama = await tokenDogrula(token);
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

export async function belgeYukle(token: string, formData: FormData): Promise<{ error?: string }> {
  const dogrulama = await tokenDogrula(token);
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
