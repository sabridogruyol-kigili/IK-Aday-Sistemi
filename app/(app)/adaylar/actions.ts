"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/lib/email";
import { uygulamaUrl } from "@/lib/appUrl";
import { mailIskelet, tarihTr, evrakSonTarih } from "@/lib/mailSablon";
import { BELGE_LISTESI, belgeGorunurMu } from "@/lib/evrakSabitleri";

// "cv-dosyalar" bucket'ı private olduğu için CV'yi görüntülemek geçici
// (süreli) bir signed URL gerektirir. 5 dakikalık süre, bir kişinin CV'yi
// popup içinde rahatça okumasına yetecek kadar uzun tutuldu.
export async function getCvSignedUrl(cvYolu: string): Promise<{ url?: string; error?: string }> {
  if (!cvYolu) return { error: "CV yolu bulunamadı." };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data, error } = await supabase.storage
    .from("cv-dosyalar")
    .createSignedUrl(cvYolu, 300);

  if (error || !data) return { error: "CV bağlantısı üretilemedi: " + error?.message };
  return { url: data.signedUrl };
}

export type AdayDetay = {
  eslesenPersonelVarMi: boolean;
  performansOrtalamaHgo: number | null;
  kidemAy: number | null;
  ilAdi: string | null;
  kanGrubu: string | null;
  uyruk: string | null;
  hgoGecmisi: { yil: number; ay: number; hgo: number | null }[];
};

// Adayın TC'siyle (varsa) personel tablosunda eşleşme aranır — eşleşme varsa
// (örn. eski çalışan tekrar başvurmuş) performans geçmişi gösterilir. TC henüz
// girilmemişse ya da eşleşme yoksa, sadece aday kartındaki temel bilgiler
// (isim/telefon/e-posta/mağaza) gösterilmeye devam eder.
export async function getAdayEslesenPersonelDetay(tcKimlikNo: string | null): Promise<AdayDetay | null> {
  if (!tcKimlikNo) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: personel } = await supabase
    .from("personel")
    .select("id, performans_ortalama_hgo, kidem_ay, kan_grubu_kodu, uyruk, magazalar(il_adi)")
    .eq("tc_kimlik_no", tcKimlikNo)
    .maybeSingle();

  if (!personel) return { eslesenPersonelVarMi: false, performansOrtalamaHgo: null, kidemAy: null, ilAdi: null, kanGrubu: null, uyruk: null, hgoGecmisi: [] };

  const { data: hgoGecmisiHam } = await supabase
    .from("performans_kisi_aylik")
    .select("yil, ay, hgo")
    .eq("personel_id", personel.id)
    .order("yil", { ascending: true })
    .order("ay", { ascending: true });

  return {
    eslesenPersonelVarMi: true,
    performansOrtalamaHgo: personel.performans_ortalama_hgo,
    kidemAy: personel.kidem_ay,
    ilAdi: (personel.magazalar as any)?.il_adi ?? null,
    kanGrubu: personel.kan_grubu_kodu,
    uyruk: personel.uyruk,
    hgoGecmisi: (hgoGecmisiHam ?? []).map((h: any) => ({ yil: h.yil, ay: h.ay, hgo: h.hgo })),
  };
}

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
  const dogumTarihi = String(formData.get("dogum_tarihi") ?? "").trim();
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
    dogum_tarihi: dogumTarihi || null,
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

export async function adayiHavuzaAl(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const adayId = String(formData.get("aday_id"));
  const { error } = await supabase.rpc("aday_havuza_al", { p_aday_id: adayId });
  return { error: error?.message };
}

export async function adayiHavuzdanYonlendir(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const adayId = String(formData.get("aday_id"));
  const yeniTalepId = String(formData.get("yeni_talep_id"));
  const { error } = await supabase.rpc("aday_havuzdan_yonlendir", { p_aday_id: adayId, p_yeni_talep_id: yeniTalepId });
  return { error: error?.message };
}

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
    .select("ad_soyad, email, durum, tc_kimlik_no, ise_baslama_tarihi, talep_id")
    .eq("id", adayId)
    .single();

  // Mail gönderimini beklemeden (arka planda) tetikle — SMTP round-trip'i kullanıcıyı bekletmesin.
  if (yeniDurum === "ISE_ALINDI" && aday?.email) {
    // Önce evrak portalı token'ı oluşturulur (varsa), sonra TEK, zengin bir
    // mailde hem onay hem işe başlama tarihi hem evrak son tarihi hem de
    // portal bağlantısı buton olarak birlikte gönderilir — önceden iki ayrı
    // mail gidiyordu, artık tek ve daha bilgilendirici bir mail gidiyor.
    let portalLink: string | null = null;

    if (aday.tc_kimlik_no) {
      const { data: yeniPersonel } = await supabase
        .from("personel")
        .select("id")
        .eq("tc_kimlik_no", aday.tc_kimlik_no)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (yeniPersonel) {
        const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const { error: tokenHata } = await supabase.from("evrak_erisim_tokenlari").insert({
          personel_id: yeniPersonel.id,
          token,
          email: aday.email,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (!tokenHata) portalLink = `${uygulamaUrl()}/evrak-portali/${token}`;
      }
    }

    const baslamaTarihiMetni = tarihTr(aday.ise_baslama_tarihi);
    const evrakSonTarihMetni = evrakSonTarih(aday.ise_baslama_tarihi);

    // Talepten pozisyon ve mağaza bilgisi çekilir — kişiye nereye/hangi
    // pozisyona başlayacağı net şekilde yazılsın diye.
    let pozisyonMetni: string | null = null;
    let magazaMetni: string | null = null;
    if (aday.talep_id) {
      const { data: talep } = await supabase
        .from("talepler")
        .select("pozisyon_tipi, magazalar!magaza_id(magaza_adi)")
        .eq("id", aday.talep_id)
        .maybeSingle();
      pozisyonMetni = talep?.pozisyon_tipi ?? null;
      magazaMetni = (talep as any)?.magazalar?.magaza_adi ?? null;
    }

    const govde = `
      <p style="margin: 0 0 14px;">Sayın <strong>${aday.ad_soyad}</strong>,</p>
      <p style="margin: 0 0 14px;">İşe alım süreciniz başarıyla <strong>onaylanmıştır</strong>. Aramıza katılacağınız için çok mutluyuz — birlikte çalışmak için sabırsızlanıyoruz!</p>
      <p style="margin: 0 0 4px;"><strong>İşe başlama tarihiniz:</strong> ${baslamaTarihiMetni}</p>
      ${pozisyonMetni ? `<p style="margin: 0 0 4px;"><strong>Pozisyonunuz:</strong> ${pozisyonMetni}</p>` : ""}
      ${magazaMetni ? `<p style="margin: 0 0 14px;"><strong>Başlayacağınız şube:</strong> ${magazaMetni}</p>` : `<p style="margin: 0 0 14px;"></p>`}
      ${portalLink ? `<p style="margin: 0 0 14px;"><strong>İşe giriş evraklarınızı</strong> aşağıdaki bağlantı üzerinden, <strong>${evrakSonTarihMetni}</strong> tamamlamanız gerekmektedir.</p>` : ""}
      <p style="margin: 14px 0 0;">Süreci istediğiniz zaman yarıda bırakıp aynı bağlantıdan devam edebilirsiniz.</p>
      <p style="margin: 18px 0 0; font-weight: 600; color: #1C2430;">Hayırlı olsun! 🎉</p>
    `;

    sendMail({
      to: aday.email,
      subject: "İşe Alımınız Onaylandı — Aramıza Hoş Geldiniz",
      text: `Sayın ${aday.ad_soyad},\n\nİşe alım süreciniz başarıyla onaylanmıştır. İşe başlama tarihiniz: ${baslamaTarihiMetni}.${pozisyonMetni ? ` Pozisyon: ${pozisyonMetni}.` : ""}${magazaMetni ? ` Şube: ${magazaMetni}.` : ""}${portalLink ? ` İşe giriş evraklarınızı ${evrakSonTarihMetni} şu bağlantıdan tamamlayın: ${portalLink}` : ""}\n\nBirlikte çalışmak için sabırsızlanıyoruz! Hayırlı olsun.`,
      html: mailIskelet({
        baslik: "İşe Alımınız Onaylandı 🎉",
        govdeHtml: govde,
        butonMetni: portalLink ? "İşe Giriş Evraklarını Tamamla" : undefined,
        butonLink: portalLink ?? undefined,
      }),
    }).catch(() => {});
  }

  return {
    error: undefined,
    aday: aday ? { durum: aday.durum, tc_kimlik_no: aday.tc_kimlik_no, ise_baslama_tarihi: aday.ise_baslama_tarihi } : undefined,
  };
}

// "İşe Alındı" durumundaki adaylar için, evrak süreci gerçekten tamamlanmadıysa
// sistemin her yerinde (Aday Havuzu, Talepler sayfası, süreç detayı) aynı
// doğru etiketin görünmesi için — tek yerden hesaplanır, tek yerden çağrılır.
export async function iseAlindiEtiketleriniHesapla(tcListesi: string[]): Promise<Record<string, string>> {
  const supabase = createClient();
  const sonuc: Record<string, string> = {};
  const gecerliTcler = tcListesi.filter(Boolean);
  if (gecerliTcler.length === 0) return sonuc;

  const { data: personeller } = await supabase
    .from("personel")
    .select("id, tc_kimlik_no, evrak_iptal_nedeni")
    .in("tc_kimlik_no", gecerliTcler);
  if (!personeller || personeller.length === 0) return sonuc;

  const personelIdleri = personeller.map((p: any) => p.id);
  const [{ data: bilgilerListesi }, { data: belgelerListesi }] = await Promise.all([
    supabase.from("personel_evrak_bilgileri").select("personel_id, cinsiyet").in("personel_id", personelIdleri),
    supabase.from("personel_evrak_belgeleri").select("personel_id, belge_tipi, durum").in("personel_id", personelIdleri),
  ]);

  for (const p of personeller) {
    if (p.evrak_iptal_nedeni) {
      sonuc[p.tc_kimlik_no] = "İşe Alım İptal Edildi";
      continue;
    }
    const cinsiyet = (bilgilerListesi ?? []).find((b: any) => b.personel_id === p.id)?.cinsiyet ?? null;
    const kendiBelgeleri = (belgelerListesi ?? []).filter((b: any) => b.personel_id === p.id);
    const gerekliBelgeler = BELGE_LISTESI.filter((b) => !b.istegeBagli && belgeGorunurMu(b, cinsiyet));
    const onaylanan = gerekliBelgeler.filter((b) => kendiBelgeleri.find((k: any) => k.belge_tipi === b.id)?.durum === "ONAYLANDI").length;
    const tamamMi = gerekliBelgeler.length > 0 && onaylanan === gerekliBelgeler.length;
    sonuc[p.tc_kimlik_no] = tamamMi ? "İşe Alındı — Evrak Tamamlandı" : `İşe Alım Onaylandı — Evrak Bekleniyor (${onaylanan}/${gerekliBelgeler.length})`;
  }
  return sonuc;
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

  const iseAlindiTcListesi = adaylar.filter((a) => a.durum === "ISE_ALINDI" && a.tc_kimlik_no).map((a) => a.tc_kimlik_no as string);
  const evrakEtiketleri = await iseAlindiEtiketleriniHesapla(iseAlindiTcListesi);

  const zenginlestirilmis = adaylar.map((a) => ({
    ...a,
    onay_tarihi: onayTarihiMap[a.id] ?? null,
    evrak_etiket: a.tc_kimlik_no ? evrakEtiketleri[a.tc_kimlik_no] ?? null : null,
  }));

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
    .select("ad_soyad, created_at, yonlendiren_rol, karari_veren_rol, durum, onay_bm, onay_ik, mulakat_bm, mulakat_ik, tc_kimlik_no")
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
  const adayDurum = aday.durum;
  const karariVerenRol = aday.karari_veren_rol;
  const onayBm = aday.onay_bm;
  const onayIk = aday.onay_ik;
  const mulakatBm = aday.mulakat_bm;
  const mulakatIk = aday.mulakat_ik;

  adimlar.push({ tarih: aday.created_at, baslik: `Aday Eklendi — ${aday.yonlendiren_rol}`, durum: "TAMAMLANDI_NOTR" });

  const durumSirasi = ["YONLENDIRILDI", "ONAYLANDI", "REDDEDILDI", "ON_GORUSME_PLANLANDI", "GORUSULDU_OLUMLU", "GORUSULDU_OLUMSUZ", "ISE_ALINDI"];
  const mevcutIndex = durumSirasi.indexOf(adayDurum);

  function mulakatAdimi(rol: "BM" | "IK", deger: string | null) {
    const tarih = enSonTarih(g, [`MULAKAT_${rol}_YAPILDI`, `MULAKAT_${rol}_YAPILMADI`]);
    if (deger === "YAPILDI") adimlar.push({ tarih, baslik: `Mülakat (${rol}) — Yapıldı`, durum: "TAMAMLANDI_OLUMLU" });
    else if (deger === "YAPILMADI") adimlar.push({ tarih, baslik: `Mülakat (${rol}) — Yapılmadı`, durum: "TAMAMLANDI_OLUMSUZ" });
    else adimlar.push({ tarih: null, baslik: `Mülakat (${rol})`, durum: adayDurum === "YONLENDIRILDI" ? "MEVCUT" : "GELECEK" });
  }

  if (adayDurum === "REDDEDILDI" || adayDurum === "ONAYLANDI" || adayDurum === "YONLENDIRILDI") {
    if (karariVerenRol === "BM_VE_IK") {
      mulakatAdimi("BM", mulakatBm);
      mulakatAdimi("IK", mulakatIk);
      const bmTarih = enSonTarih(g, ["ARA_KARAR_BM_ONAY", "ARA_KARAR_BM_RED"]);
      const ikTarih = enSonTarih(g, ["ARA_KARAR_IK_ONAY", "ARA_KARAR_IK_RED"]);
      adimlar.push({
        tarih: bmTarih,
        baslik: onayBm ? `BM Kararı — ${onayBm === "ONAY" ? "Onayladı" : "Reddetti"}` : "BM Kararı",
        durum: onayBm === "ONAY" ? "TAMAMLANDI_OLUMLU" : onayBm === "RED" ? "TAMAMLANDI_OLUMSUZ" : "MEVCUT",
      });
      adimlar.push({
        tarih: ikTarih,
        baslik: onayIk ? `İK Kararı — ${onayIk === "ONAY" ? "Onayladı" : "Reddetti"}` : "İK Kararı",
        durum: onayIk === "ONAY" ? "TAMAMLANDI_OLUMLU" : onayIk === "RED" ? "TAMAMLANDI_OLUMSUZ" : "MEVCUT",
      });
    } else {
      const rol = karariVerenRol as "BM" | "IK";
      mulakatAdimi(rol, rol === "BM" ? mulakatBm : mulakatIk);
      const kararTarihi = enSonTarih(g, ["ONAYLANDI", "REDDEDILDI"]);
      adimlar.push({
        tarih: adayDurum === "YONLENDIRILDI" ? null : kararTarihi,
        baslik: adayDurum === "ONAYLANDI" ? `Karar (${rol}) — Onayladı` : adayDurum === "REDDEDILDI" ? `Karar (${rol}) — Reddetti` : `Karar (${rol})`,
        durum: adayDurum === "ONAYLANDI" ? "TAMAMLANDI_OLUMLU" : adayDurum === "REDDEDILDI" ? "TAMAMLANDI_OLUMSUZ" : "MEVCUT",
      });
    }
  } else {
    adimlar.push({ tarih: enSonTarih(g, ["ONAYLANDI"]), baslik: "Karar — Onaylandı", durum: "TAMAMLANDI_OLUMLU" });
  }

  if (adayDurum === "REDDEDILDI") {
    return { data: adimlar };
  }

  adimlar.push({
    tarih: enSonTarih(g, ["ON_GORUSME_PLANLANDI"]),
    baslik: "Ön Görüşme Planlandı",
    durum: mevcutIndex > durumSirasi.indexOf("ON_GORUSME_PLANLANDI") ? "TAMAMLANDI_NOTR"
      : adayDurum === "ON_GORUSME_PLANLANDI" ? "TAMAMLANDI_NOTR"
      : adayDurum === "ONAYLANDI" ? "MEVCUT" : "GELECEK",
  });

  const gorusuldu = adayDurum === "GORUSULDU_OLUMLU" || adayDurum === "GORUSULDU_OLUMSUZ" || adayDurum === "ISE_ALINDI";
  adimlar.push({
    tarih: enSonTarih(g, ["GORUSULDU_OLUMLU", "GORUSULDU_OLUMSUZ"]),
    baslik: adayDurum === "GORUSULDU_OLUMSUZ" ? "Görüşüldü — Olumsuz" : gorusuldu ? "Görüşüldü — Olumlu" : "Görüşüldü",
    durum: adayDurum === "GORUSULDU_OLUMLU" || adayDurum === "ISE_ALINDI" ? "TAMAMLANDI_OLUMLU"
      : adayDurum === "GORUSULDU_OLUMSUZ" ? "TAMAMLANDI_OLUMSUZ"
      : adayDurum === "ON_GORUSME_PLANLANDI" ? "MEVCUT" : "GELECEK",
  });

  if (adayDurum === "GORUSULDU_OLUMSUZ") {
    return { data: adimlar };
  }

  adimlar.push({
    tarih: enSonTarih(g, ["ISE_ALINDI"]),
    baslik: "İşe Alındı",
    durum: adayDurum === "ISE_ALINDI" ? "TAMAMLANDI_OLUMLU" : adayDurum === "GORUSULDU_OLUMLU" ? "MEVCUT" : "GELECEK",
  });

  // Son adım: Evrak Tamamlandı — işe alım gerçek anlamda bittiyse (personel
  // hâlâ aktifse ve tüm zorunlu belgeler onaylandıysa) yeşil, süreç devam
  // ediyorsa (personel var ama belgeler eksik/incelemede) turuncu/mevcut,
  // henüz işe alınmadıysa gri.
  if (adayDurum === "ISE_ALINDI" && aday.tc_kimlik_no) {
    const { data: personel } = await supabase
      .from("personel")
      .select("id, durum, evrak_iptal_nedeni")
      .eq("tc_kimlik_no", aday.tc_kimlik_no)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (personel?.evrak_iptal_nedeni) {
      adimlar.push({ tarih: null, baslik: "İşe Alım İptal Edildi", durum: "TAMAMLANDI_OLUMSUZ" });
    } else if (personel) {
      const { data: bilgi } = await supabase.from("personel_evrak_bilgileri").select("cinsiyet").eq("personel_id", personel.id).maybeSingle();
      const { data: belgelerHam } = await supabase.from("personel_evrak_belgeleri").select("belge_tipi, durum").eq("personel_id", personel.id);
      const gerekliBelgeler = BELGE_LISTESI.filter((b) => !b.istegeBagli && belgeGorunurMu(b, bilgi?.cinsiyet ?? null));
      const onaylanan = gerekliBelgeler.filter((b) => (belgelerHam ?? []).find((s: any) => s.belge_tipi === b.id)?.durum === "ONAYLANDI").length;
      const tamamMi = gerekliBelgeler.length > 0 && onaylanan === gerekliBelgeler.length;
      adimlar.push({
        tarih: null,
        baslik: tamamMi ? "Evrak Tamamlandı" : `Evrak Bekleniyor (${onaylanan}/${gerekliBelgeler.length})`,
        durum: tamamMi ? "TAMAMLANDI_OLUMLU" : "MEVCUT",
      });
    }
  }

  return { data: adimlar };
}
