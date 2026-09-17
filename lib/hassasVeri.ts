// Hassas alan görünürlüğü + denetim kaydı için paylaşılan sunucu yardımcıları.
// Bu dosya "use server" DEĞİL — sadece "use server" action dosyaları içinden
// import edilen düz yardımcı fonksiyonlar barındırır.

export const HASSAS_ALANLAR = ["tc_kimlik_no", "ozel_mobil", "dogum_tarihi", "kan_grubu_kodu", "brut_maas", "beden_olculeri"] as const;
export type HassasAlan = typeof HASSAS_ALANLAR[number];

export const HASSAS_ALAN_ETIKET: Record<HassasAlan, string> = {
  tc_kimlik_no: "TC Kimlik No",
  ozel_mobil: "Telefon",
  dogum_tarihi: "Doğum Tarihi",
  kan_grubu_kodu: "Kan Grubu",
  brut_maas: "Brüt Maaş / Kıdem Tazminatı",
  beden_olculeri: "Beden Ölçüleri",
};

// Ayarları değiştirebilecek roller dışındakiler (Yönetim hariç herkes) için
// matris kullanılır. Yönetim her zaman tüm hassas alanları görebilir — kendi
// kendini kısıtlayamaz.
export const KISITLANABILIR_ROLLER = ["BM", "IK", "MAGAZALAR_DIREKTORLUGU", "BORDRO", "CALISAN"] as const;

type SupabaseClient = any;

export async function rolGorunurlukleri(supabase: SupabaseClient, rol: string): Promise<Record<HassasAlan, boolean>> {
  const varsayilan = {} as Record<HassasAlan, boolean>;
  HASSAS_ALANLAR.forEach((a) => { varsayilan[a] = true; });

  if (rol === "YONETIM") return varsayilan;

  const { data } = await supabase.from("alan_gorunurluk_ayarlari").select("alan, gorebilir").eq("rol", rol);
  (data ?? []).forEach((d: any) => {
    if (HASSAS_ALANLAR.includes(d.alan)) varsayilan[d.alan as HassasAlan] = d.gorebilir;
  });
  return varsayilan;
}

export async function rolGorebilirMi(supabase: SupabaseClient, rol: string, alan: HassasAlan): Promise<boolean> {
  const gorunurlukler = await rolGorunurlukleri(supabase, rol);
  return gorunurlukler[alan];
}

export async function denetimKaydet(supabase: SupabaseClient, params: {
  kullaniciId: string; kullaniciAdSoyad: string; rol: string; hedefTablo: string; hedefId: string; alan: string;
}) {
  await supabase.from("denetim_kaydi").insert({
    kullanici_id: params.kullaniciId,
    kullanici_ad_soyad: params.kullaniciAdSoyad,
    rol: params.rol,
    aksiyon: "HASSAS_ALAN_GORUNTULEME",
    hedef_tablo: params.hedefTablo,
    hedef_id: params.hedefId,
    alan: params.alan,
  });
}
