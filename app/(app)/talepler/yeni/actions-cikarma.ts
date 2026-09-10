"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type Sonuc = { error?: string; norm_uyari?: string };

export async function createIstenCikarmaTalebi(formData: FormData): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return { error: "Kullanıcı bulunamadı." };

  const personelId = String(formData.get("personel_id") ?? "");
  const yerineAlim = formData.get("yerine_alim") === "true";
  const pozisyonTipi = String(formData.get("pozisyon_tipi") ?? "");
  const kisiSayisi = parseInt(String(formData.get("kisi_sayisi") ?? "0"), 10);
  const aciklama = String(formData.get("aciklama") ?? "").trim();
  const israrli = formData.get("israrli") === "true";

  if (!personelId) return { error: "Çıkarılacak personel seçimi zorunlu." };

  const { data: personel } = await supabase
    .from("personel")
    .select("id, ad_soyad, guncel_magaza_id, kadro_kategorisi, performans_ortalama_hgo")
    .eq("id", personelId)
    .single();
  if (!personel) return { error: "Personel bulunamadı." };

  // Tasarım notu 4.3 / 5.4: ortalama HGO %80 altındaysa açıklama zorunlu (norm aşımından bağımsız bir kural)
  const hgoDusuk = personel.performans_ortalama_hgo != null && personel.performans_ortalama_hgo < 80;
  if (hgoDusuk && aciklama.length < 100) {
    return { error: "Bu personelin ortalama performansı (HGO) %80'in altında — en az 100 karakterlik açıklama girmeniz zorunlu." };
  }

  let normUyari: string | undefined;
  let normSonuc: "UYGUN" | "UYGUN_DEGIL_ISRARLI" = "UYGUN";

  if (yerineAlim) {
    if (!pozisyonTipi || !kisiSayisi || kisiSayisi < 1) {
      return { error: "Yerine alım için pozisyon tipi ve kişi sayısı zorunlu." };
    }

    const { data: unvanKaydi } = await supabase
      .from("unvan_kadro_kategorisi")
      .select("kategori")
      .eq("unvan", pozisyonTipi)
      .single();

    const kategori = unvanKaydi?.kategori as "ANA_KADRO" | "DONEMSEL" | "PART_TIME" | undefined;
    if (!kategori || !["ANA_KADRO", "DONEMSEL", "PART_TIME"].includes(kategori)) {
      return { error: "Geçersiz pozisyon tipi." };
    }

    const { data: norm } = await supabase
      .from("norm")
      .select("ana_kadro_norm, donemsel_norm, part_time_norm")
      .eq("magaza_id", personel.guncel_magaza_id)
      .single();

    const toplamNorm =
      kategori === "ANA_KADRO" ? norm?.ana_kadro_norm ?? 0
      : kategori === "DONEMSEL" ? norm?.donemsel_norm ?? 0
      : norm?.part_time_norm ?? 0;

    const { count: aktifPersonelSayisi } = await supabase
      .from("personel")
      .select("*", { count: "exact", head: true })
      .eq("guncel_magaza_id", personel.guncel_magaza_id)
      .eq("durum", "aktif")
      .not("tc_kimlik_no", "like", "PLASIYER-%")
      .eq("kadro_kategorisi", kategori);

    const { data: kategoriUnvanlariHam } = await supabase
      .from("unvan_kadro_kategorisi")
      .select("unvan")
      .eq("kategori", kategori);
    const kategoriPozisyonlari = (kategoriUnvanlariHam ?? []).map((u) => u.unvan);

    const { data: bekleyenTalepler } = await supabase
      .from("talepler")
      .select("kisi_sayisi")
      .eq("magaza_id", personel.guncel_magaza_id)
      .in("durum", ["BEKLEMEDE", "ISLEME_DEVAM", "DURAKLADI"])
      .in("pozisyon_tipi", kategoriPozisyonlari);

    const bekleyenKisiSayisi = (bekleyenTalepler ?? []).reduce((s, t) => s + (t.kisi_sayisi ?? 0), 0);
    const cikanDusum = personel.kadro_kategorisi === kategori ? 1 : 0;
    const doluSayi = (aktifPersonelSayisi ?? 0) + bekleyenKisiSayisi - cikanDusum;
    const kalanKontenjan = toplamNorm - doluSayi;
    const uygun = kisiSayisi <= kalanKontenjan;

    if (!uygun && !israrli) {
      return {
        norm_uyari: `Norm yetersiz — ${kategori} kategorisinde toplam norm: ${toplamNorm}, dolu+bekleyen: ${doluSayi}, kalan kontenjan: ${kalanKontenjan}.`,
      };
    }
    if (!uygun && israrli && aciklama.length < 100) {
      return { error: "Norm aşıldığı için en az 100 karakterlik açıklama girmeniz zorunlu." };
    }
    normSonuc = uygun ? "UYGUN" : "UYGUN_DEGIL_ISRARLI";
  }

  const { data: talepNo } = await supabase.rpc("sonraki_talep_no");
  if (!talepNo) return { error: "Talep numarası üretilemedi." };

  const { data: yeniTalep, error: talepHata } = await supabase
    .from("talepler")
    .insert({
      talep_no: talepNo,
      talep_turu: "ISTEN_CIKARMA",
      magaza_id: personel.guncel_magaza_id,
      acan_kullanici_id: me.id,
      acan_rol: me.rol,
      cikarilacak_personel_id: personelId,
      yerine_alim_yapilacak: yerineAlim,
      pozisyon_tipi: yerineAlim ? pozisyonTipi : null,
      kisi_sayisi: yerineAlim ? kisiSayisi : null,
      durum: "BEKLEMEDE",
      aktif_gonderim_no: 1,
    })
    .select("id")
    .single();
  if (talepHata || !yeniTalep) return { error: "Talep oluşturulamadı: " + talepHata?.message };

  const { data: gonderim, error: gonderimHata } = await supabase
    .from("talep_gonderimler")
    .insert({
      talep_id: yeniTalep.id,
      gonderim_no: 1,
      aciklama: aciklama || null,
      norm_kontrol_sonucu: yerineAlim ? normSonuc : null,
    })
    .select("id")
    .single();
  if (gonderimHata || !gonderim) return { error: "Gönderim kaydı oluşturulamadı." };

  const { data: magaza } = await supabase
    .from("magazalar").select("bolge_id").eq("id", personel.guncel_magaza_id).single();

  const onayRolleri = (["BM", "IK", "YONETIM"] as const).filter((r) => r !== me.rol);
  const onaySatirlari: { gonderim_id: string; onaylayici_kullanici_id: string; onaylayici_rol_baglami: string }[] = [];

  await Promise.all(onayRolleri.map(async (rol) => {
    if (rol === "YONETIM") {
      const { data: yonetimler } = await supabase
        .from("kullanicilar").select("id").eq("rol", "YONETIM").eq("aktif", true);
      (yonetimler ?? []).forEach((y) =>
        onaySatirlari.push({ gonderim_id: gonderim.id, onaylayici_kullanici_id: y.id, onaylayici_rol_baglami: "YONETIM" })
      );
    } else {
      const { data: bolgeliler } = await supabase
        .from("kullanici_bolge_atama")
        .select("kullanici_id, kullanicilar!inner(rol, aktif)")
        .eq("bolge_id", magaza?.bolge_id)
        .eq("kullanicilar.rol", rol)
        .eq("kullanicilar.aktif", true);
      (bolgeliler ?? []).forEach((b: any) =>
        onaySatirlari.push({ gonderim_id: gonderim.id, onaylayici_kullanici_id: b.kullanici_id, onaylayici_rol_baglami: rol })
      );
    }
  }));

  if (onaySatirlari.length > 0) {
    await supabase.from("talep_onaylari").insert(onaySatirlari);
  }

  revalidatePath("/talepler");
  redirect("/talepler");
}

// Seçilen personelin aylık HGO geçmişi — sağ taraftaki grafikler için.
export type PersonelAylikHgo = {
  yil: number; ay: number; hgo: number | null; adet_hgo: number | null;
  gerceklesen_ciro_kdv_dahil: number | null; gerceklesen_adet: number | null; brut_kar_marji: number | null;
  brut_satis_adeti: number | null;
};

export async function getPersonelPerformansGecmisi(personelId: string): Promise<PersonelAylikHgo[]> {
  if (!personelId) return [];
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("performans_kisi_aylik")
    .select("yil, ay, hgo, adet_hgo, gerceklesen_ciro_kdv_dahil, gerceklesen_adet, brut_kar_marji, brut_satis_adeti")
    .eq("personel_id", personelId)
    .order("yil", { ascending: true })
    .order("ay", { ascending: true });

  return (data ?? []) as PersonelAylikHgo[];
}

// Kişi seçilince gösterilecek ek özlük bilgileri — sadece seçilen kişi için anlık
// çekilir (tüm personel listesine bu ağır alanları eklemeyip performansı koruyoruz).
export type PersonelDetay = {
  dogum_tarihi: string | null;
  kan_grubu_kodu: string | null;
  uyruk: string | null;
  evli: string | null;
  onceki_is_yeri: string | null;
  ihtarname: string | null;
  uyari_yazisi: string | null;
  tutanak: string | null;
  savunma: string | null;
  notlar: string | null;
  il_adi: string | null;
  ozel_mobil: string | null;
  tc_kimlik_no: string | null;
  personel_kodu: string | null;
  kidem_ay: number | null;
  brut_maas: number | null;
  kidem_tazminati_tavani: number | null;
  kidem_tazminati_tahmini: number | null;
};

// Personel Listesi sayfasındaki (app/(app)/personel/page.tsx) mantıkla birebir
// aynı kural: ardışık atama dönemleri arasında 2 aydan fazla boşluk varsa kıdem
// o yeni dönemden itibaren sıfırdan sayılır.
function kidemAyHesapla(donemler: { baslama_tarihi: string | null; ayrilma_tarihi: string | null }[]): number | null {
  const gecerliler = donemler
    .filter((d) => d.baslama_tarihi)
    .map((d) => ({ baslama: new Date(d.baslama_tarihi as string), ayrilma: d.ayrilma_tarihi ? new Date(d.ayrilma_tarihi) : null }))
    .sort((a, b) => a.baslama.getTime() - b.baslama.getTime());

  if (gecerliler.length === 0) return null;

  let donemBaslangic = gecerliler[0].baslama;
  for (let i = 1; i < gecerliler.length; i++) {
    const oncekiBitis = gecerliler[i - 1].ayrilma;
    const buBaslangic = gecerliler[i].baslama;
    if (oncekiBitis) {
      const bosluk_ay = (buBaslangic.getTime() - oncekiBitis.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (bosluk_ay > 2) donemBaslangic = buBaslangic;
    }
  }

  const simdi = new Date();
  return Math.max((simdi.getFullYear() - donemBaslangic.getFullYear()) * 12 + (simdi.getMonth() - donemBaslangic.getMonth()), 0);
}

export type PersonelIsGecmisiSatiri = {
  magaza_adi: string;
  baslama_tarihi: string | null;
  ayrilma_tarihi: string | null;
};

// Kişinin geçmişte çalıştığı tüm mağazaları (mevcut dahil), başlama/ayrılma
// tarihleriyle birlikte döndürür — en yeni atama en üstte.
export async function getPersonelIsGecmisi(personelId: string): Promise<PersonelIsGecmisiSatiri[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("personel_atama_gecmisi")
    .select("baslama_tarihi, ayrilma_tarihi, magazalar!magaza_id(magaza_adi)")
    .eq("personel_id", personelId)
    .order("baslama_tarihi", { ascending: false });

  return (data ?? []).map((d: any) => ({
    magaza_adi: d.magazalar?.magaza_adi ?? "—",
    baslama_tarihi: d.baslama_tarihi,
    ayrilma_tarihi: d.ayrilma_tarihi,
  }));
}

export async function getPersonelDetay(personelId: string): Promise<PersonelDetay | null> {
  if (!personelId) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("personel")
    .select("dogum_tarihi, kan_grubu_kodu, uyruk, evli, onceki_is_yeri, ihtarname, uyari_yazisi, tutanak, savunma, notlar, ozel_mobil, tc_kimlik_no, personel_kodu, brut_maas, magazalar(il_adi)")
    .eq("id", personelId)
    .single();

  if (!data) return null;

  const { data: atamalar } = await supabase
    .from("personel_atama_gecmisi")
    .select("baslama_tarihi, ayrilma_tarihi")
    .eq("personel_id", personelId);

  const { data: ayar } = await supabase.from("sistem_ayarlari").select("kidem_tazminati_tavani").eq("id", 1).single();
  const tavan = ayar?.kidem_tazminati_tavani ?? null;

  const magazaHam = data as any;
  const kidemAy = kidemAyHesapla(atamalar ?? []);
  const brutMaas = magazaHam.brut_maas as number | null;

  // Basit tahmini kıdem tazminatı: (tavanı aşmayan brüt maaş) × kıdem yılı.
  // "Giydirilmiş ücret" değil, sade brüt maaş kullanılır — prim ve ek ücretler
  // hariçtir, bu yüzden gerçek tutardan farklı (genelde daha düşük) çıkabilir.
  let kidemTazminatiTahmini: number | null = null;
  if (brutMaas != null && tavan != null && kidemAy != null) {
    const esasAlinanMaas = Math.min(brutMaas, tavan);
    kidemTazminatiTahmini = Math.round(esasAlinanMaas * (kidemAy / 12) * 100) / 100;
  }

  return {
    dogum_tarihi: magazaHam.dogum_tarihi,
    kan_grubu_kodu: magazaHam.kan_grubu_kodu,
    uyruk: magazaHam.uyruk,
    evli: magazaHam.evli,
    onceki_is_yeri: magazaHam.onceki_is_yeri,
    ihtarname: magazaHam.ihtarname,
    uyari_yazisi: magazaHam.uyari_yazisi,
    tutanak: magazaHam.tutanak,
    ozel_mobil: magazaHam.ozel_mobil,
    tc_kimlik_no: magazaHam.tc_kimlik_no,
    personel_kodu: magazaHam.personel_kodu,
    savunma: magazaHam.savunma,
    notlar: magazaHam.notlar,
    il_adi: magazaHam.magazalar?.il_adi ?? null,
    kidem_ay: kidemAy,
    brut_maas: brutMaas,
    kidem_tazminati_tavani: tavan,
    kidem_tazminati_tahmini: kidemTazminatiTahmini,
  };
}
