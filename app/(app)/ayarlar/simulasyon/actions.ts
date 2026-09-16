"use server";

import { createClient } from "@/lib/supabase/server";
import { ilerletDurum } from "../../adaylar/actions";

export async function simulasyonIseAl(params: {
  magazaId: string; unvan: string; adSoyad: string; email: string;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { error: "Sadece Yönetim bu işlemi yapabilir." };

  const { magazaId, unvan, adSoyad, email } = params;
  if (!magazaId || !unvan.trim() || !adSoyad.trim() || !email.trim()) {
    return { error: "Şube, ünvan, ad soyad ve e-posta zorunludur." };
  }

  const { data: bm } = await supabase.from("kullanicilar").select("id").eq("rol", "BM").eq("aktif", true).limit(1).maybeSingle();
  const { data: ik } = await supabase.from("kullanicilar").select("id").eq("rol", "IK").eq("aktif", true).limit(1).maybeSingle();
  const { data: yonetimler } = await supabase.from("kullanicilar").select("id").eq("rol", "YONETIM").eq("aktif", true).limit(2);
  if (!bm || !ik || !yonetimler || yonetimler.length === 0) {
    return { error: "Simülasyon için sistemde aktif BM, İK ve Yönetim kullanıcısı bulunmalı." };
  }
  const yon1 = yonetimler[0];
  const yon2 = yonetimler[1] ?? null;

  const simdi = new Date();

  // 1) Talep — doğrudan Kabul Edildi durumunda oluşturuluyor (simülasyon
  // amacıyla, gerçek onay akışını tek seferde tamamlanmış varsayıyoruz).
  const talepNo = `${simdi.getFullYear()}-${String(Math.floor(Math.random() * 9000 + 1000))}`;
  const { data: talep, error: talepHata } = await supabase
    .from("talepler")
    .insert({
      talep_no: talepNo, talep_turu: "ISE_ALIM", magaza_id: magazaId,
      acan_kullanici_id: bm.id, acan_rol: "BM", pozisyon_tipi: unvan.trim(),
      kisi_sayisi: 1, durum: "KABUL_EDILDI", aktif_gonderim_no: 1,
    })
    .select("id")
    .single();
  if (talepHata || !talep) return { error: "Talep oluşturulamadı: " + (talepHata?.message ?? "bilinmeyen hata") };

  const { data: gonderim, error: gonderimHata } = await supabase
    .from("talep_gonderimler")
    .insert({ talep_id: talep.id, gonderim_no: 1, aciklama: "[Simülasyon] Test amaçlı otomatik oluşturuldu.", norm_kontrol_sonucu: "UYGUN" })
    .select("id")
    .single();
  if (gonderimHata || !gonderim) return { error: "Talep gönderimi oluşturulamadı: " + (gonderimHata?.message ?? "bilinmeyen hata") };

  const onaylarKayit = [
    { gonderim_id: gonderim.id, onaylayici_kullanici_id: ik.id, onaylayici_rol_baglami: "IK", karar: "ONAY", karar_tarihi: simdi.toISOString() },
    { gonderim_id: gonderim.id, onaylayici_kullanici_id: yon1.id, onaylayici_rol_baglami: "YONETIM", karar: "ONAY", karar_tarihi: simdi.toISOString() },
  ];
  if (yon2) onaylarKayit.push({ gonderim_id: gonderim.id, onaylayici_kullanici_id: yon2.id, onaylayici_rol_baglami: "YONETIM", karar: "ONAY", karar_tarihi: simdi.toISOString() });
  await supabase.from("talep_onaylari").insert(onaylarKayit);

  // 2) Aday — BM'nin İK'ya yönlendirip, İK'nın onayladığı, mülakatların
  // yapıldığı, görüşmenin olumlu geçtiği (yani "İşe Al" adımına hazır)
  // duruma kadar tüm süreç tek seferde oluşturuluyor.
  const { data: aday, error: adayHata } = await supabase
    .from("adaylar")
    .insert({
      talep_id: talep.id, ad_soyad: adSoyad.trim(), email: email.trim(),
      yonlendiren_kullanici_id: bm.id, yonlendiren_rol: "BM", karari_veren_rol: "IK",
      durum: "GORUSULDU_OLUMLU", mulakat_bm: "YAPILDI", mulakat_ik: "YAPILDI",
    })
    .select("id")
    .single();
  if (adayHata || !aday) return { error: "Aday oluşturulamadı: " + (adayHata?.message ?? "bilinmeyen hata") };

  await supabase.from("aday_surec_gecmisi").insert([
    { aday_id: aday.id, durum: "YONLENDIRILDI", aciklama: "[Simülasyon] BM tarafından İK'ya yönlendirildi.", degistiren_kullanici_id: bm.id },
    { aday_id: aday.id, durum: "ONAYLANDI", degistiren_kullanici_id: ik.id },
    { aday_id: aday.id, durum: "ON_GORUSME_PLANLANDI", degistiren_kullanici_id: ik.id },
    { aday_id: aday.id, durum: "GORUSULDU_OLUMLU", aciklama: "[Simülasyon] Görüşme olumlu geçti.", degistiren_kullanici_id: ik.id },
  ]);

  // 3) İşe Al — gerçek "İşe Al" butonuyla AYNI mekanizma: personel kaydı
  // oluşturulur, evrak portalı token'ı açılır, gerçek "İşe Alımınız
  // Onaylandı" maili gönderilir. Test amaçlı, gerçek olmayan ("9" ile
  // başlayan) bir TC kullanılıyor.
  const testTc = "9" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  const fd = new FormData();
  fd.set("aday_id", aday.id);
  fd.set("yeni_durum", "ISE_ALINDI");
  fd.set("tc_kimlik_no", testTc);
  fd.set("baslangic_tarihi", simdi.toISOString().slice(0, 10));

  const sonuc = await ilerletDurum(fd);
  if (sonuc.error) return { error: "Talep/aday oluşturuldu ama İşe Al adımı başarısız: " + sonuc.error };

  return {};
}
