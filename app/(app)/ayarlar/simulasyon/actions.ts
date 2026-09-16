"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/lib/email";
import { uygulamaUrl } from "@/lib/appUrl";
import { mailIskelet, tarihTr, evrakSonTarih } from "@/lib/mailSablon";

export async function simulasyonIseAl(params: {
  magazaId: string; unvan: string; adSoyad: string; email: string;
}): Promise<{ error?: string }> {
  // Yetki kontrolü NORMAL (RLS'e tabi) bağlantıyla yapılıyor — sadece
  // gerçekten Yönetim olduğu doğrulanan biri devam edebilir.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { error: "Sadece Yönetim bu işlemi yapabilir." };

  const { magazaId, unvan, adSoyad, email } = params;
  if (!magazaId || !unvan.trim() || !adSoyad.trim() || !email.trim()) {
    return { error: "Şube, ünvan, ad soyad ve e-posta zorunludur." };
  }

  // Bundan sonraki TÜM işlemler ADMIN (RLS'i atlayan) bağlantıyla yapılıyor
  // — çünkü simülasyon, talebi "BM açtı", kararı "İK verdi" gibi BAŞKA
  // kullanıcılar adına kayıt oluşturuyor; bu, normal (RLS'e tabi)
  // bağlantıyla yapılırsa "bir kullanıcı başkası adına kayıt oluşturamaz"
  // kuralına takılır. Yetki kontrolü zaten yukarıda yapıldığı için burada
  // güvenlik açığı oluşturmuyor.
  const admin = createAdminClient();

  const { data: bm } = await admin.from("kullanicilar").select("id").eq("rol", "BM").eq("aktif", true).limit(1).maybeSingle();
  const { data: ik } = await admin.from("kullanicilar").select("id").eq("rol", "IK").eq("aktif", true).limit(1).maybeSingle();
  const { data: yonetimler } = await admin.from("kullanicilar").select("id").eq("rol", "YONETIM").eq("aktif", true).limit(2);
  if (!bm || !ik || !yonetimler || yonetimler.length === 0) {
    return { error: "Simülasyon için sistemde aktif BM, İK ve Yönetim kullanıcısı bulunmalı." };
  }
  const yon1 = yonetimler[0];
  const yon2 = yonetimler[1] ?? null;

  const simdi = new Date();

  const talepNo = `${simdi.getFullYear()}-${String(Math.floor(Math.random() * 9000 + 1000))}`;
  const { data: talep, error: talepHata } = await admin
    .from("talepler")
    .insert({
      talep_no: talepNo, talep_turu: "ISE_ALIM", magaza_id: magazaId,
      acan_kullanici_id: bm.id, acan_rol: "BM", pozisyon_tipi: unvan.trim(),
      kisi_sayisi: 1, durum: "KABUL_EDILDI", aktif_gonderim_no: 1,
    })
    .select("id")
    .single();
  if (talepHata || !talep) return { error: "Talep oluşturulamadı: " + (talepHata?.message ?? "bilinmeyen hata") };

  const { data: gonderim, error: gonderimHata } = await admin
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
  await admin.from("talep_onaylari").insert(onaylarKayit);

  const { data: aday, error: adayHata } = await admin
    .from("adaylar")
    .insert({
      talep_id: talep.id, ad_soyad: adSoyad.trim(), email: email.trim(),
      yonlendiren_kullanici_id: bm.id, yonlendiren_rol: "BM", karari_veren_rol: "IK",
      durum: "GORUSULDU_OLUMLU", mulakat_bm: "YAPILDI", mulakat_ik: "YAPILDI",
    })
    .select("id")
    .single();
  if (adayHata || !aday) return { error: "Aday oluşturulamadı: " + (adayHata?.message ?? "bilinmeyen hata") };

  await admin.from("aday_surec_gecmisi").insert([
    { aday_id: aday.id, durum: "YONLENDIRILDI", aciklama: "[Simülasyon] BM tarafından İK'ya yönlendirildi.", degistiren_kullanici_id: bm.id },
    { aday_id: aday.id, durum: "ONAYLANDI", degistiren_kullanici_id: ik.id },
    { aday_id: aday.id, durum: "ON_GORUSME_PLANLANDI", degistiren_kullanici_id: ik.id },
    { aday_id: aday.id, durum: "GORUSULDU_OLUMLU", aciklama: "[Simülasyon] Görüşme olumlu geçti.", degistiren_kullanici_id: ik.id },
  ]);

  // İşe Al — gerçek "İşe Al" butonuyla AYNI RPC ve mail mantığı, ama admin
  // bağlantıyla çalıştırılıyor (RLS'e takılmaması için).
  const testTc = "9" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  const baslangicTarihi = simdi.toISOString().slice(0, 10);

  const { error: rpcHata } = await admin.rpc("aday_durum_ilerlet", {
    p_aday_id: aday.id,
    p_yeni_durum: "ISE_ALINDI",
    p_not: "[Simülasyon] Test amaçlı işe alım.",
    p_tc_kimlik_no: testTc,
    p_baslangic_tarihi: baslangicTarihi,
  });
  if (rpcHata) return { error: "Talep/aday oluşturuldu ama İşe Al adımı başarısız: " + rpcHata.message };

  // Gerçek "İşe Alımınız Onaylandı" maili — adaylar/actions.ts'teki
  // ilerletDurum'daki mail mantığının birebir aynısı.
  let portalLink: string | null = null;
  const { data: yeniPersonel } = await admin.from("personel").select("id").eq("tc_kimlik_no", testTc).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (yeniPersonel) {
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const { error: tokenHata } = await admin.from("evrak_erisim_tokenlari").insert({
      personel_id: yeniPersonel.id, token, email: email.trim(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (!tokenHata) portalLink = `${uygulamaUrl()}/evrak-portali/${token}`;
  }

  const { data: magaza } = await admin.from("magazalar").select("magaza_adi").eq("id", magazaId).maybeSingle();
  const baslamaTarihiMetni = tarihTr(baslangicTarihi);
  const evrakSonTarihMetni = evrakSonTarih(baslangicTarihi);

  const govde = `
    <p style="margin: 0 0 14px;">Sayın <strong>${adSoyad.trim()}</strong>,</p>
    <p style="margin: 0 0 14px;">İşe alım süreciniz başarıyla <strong>onaylanmıştır</strong>. Aramıza katılacağınız için çok mutluyuz — birlikte çalışmak için sabırsızlanıyoruz!</p>
    <p style="margin: 0 0 4px;"><strong>İşe başlama tarihiniz:</strong> ${baslamaTarihiMetni}</p>
    <p style="margin: 0 0 4px;"><strong>Pozisyonunuz:</strong> ${unvan.trim()}</p>
    <p style="margin: 0 0 14px;"><strong>Başlayacağınız şube:</strong> ${magaza?.magaza_adi ?? "—"}</p>
    ${portalLink ? `<p style="margin: 0 0 14px;"><strong>İşe giriş evraklarınızı</strong> aşağıdaki bağlantı üzerinden, <strong>${evrakSonTarihMetni}</strong> tamamlamanız gerekmektedir.</p>` : ""}
    <p style="margin: 14px 0 0;">Süreci istediğiniz zaman yarıda bırakıp aynı bağlantıdan devam edebilirsiniz.</p>
    <p style="margin: 18px 0 0; font-weight: 600; color: #1C2430;">Hayırlı olsun! 🎉</p>
  `;

  const { error: mailHata } = await sendMail({
    to: email.trim(),
    subject: "İşe Alımınız Onaylandı — Aramıza Hoş Geldiniz",
    text: `Sayın ${adSoyad.trim()},\n\nİşe alım süreciniz başarıyla onaylanmıştır. İşe başlama tarihiniz: ${baslamaTarihiMetni}. Pozisyon: ${unvan.trim()}. Şube: ${magaza?.magaza_adi ?? "—"}.${portalLink ? ` İşe giriş evraklarınızı ${evrakSonTarihMetni} şu bağlantıdan tamamlayın: ${portalLink}` : ""}\n\nBirlikte çalışmak için sabırsızlanıyoruz! Hayırlı olsun.`,
    html: mailIskelet({
      baslik: "İşe Alımınız Onaylandı 🎉",
      govdeHtml: govde,
      butonMetni: portalLink ? "İşe Giriş Evraklarını Tamamla" : undefined,
      butonLink: portalLink ?? undefined,
    }),
  });
  if (mailHata) return { error: "Süreç tamamlandı ama mail gönderilemedi: " + mailHata };

  revalidatePath("/talepler");
  return {};
}
