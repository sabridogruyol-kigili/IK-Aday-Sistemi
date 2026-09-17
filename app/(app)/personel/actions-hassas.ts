"use server";

import { createClient } from "@/lib/supabase/server";
import { rolGorebilirMi, denetimKaydet, type HassasAlan } from "@/lib/hassasVeri";

type Sonuc<T> = { deger: T | null; error?: string };

// Tek bir hassas metin/tarih alanını (TC, telefon, doğum tarihi, kan grubu)
// anlık olarak getirir — rol yetkisi kontrol edilir ve her başarılı erişim
// denetim_kaydi tablosuna yazılır. Değer başlangıçta HİÇBİR yerde client'a
// gönderilmez, sadece bu action çağrıldığında.
export async function hassasAlanGetir(
  hedefTablo: "personel" | "adaylar" | "olumsuz_referans_listesi",
  hedefId: string,
  alan: HassasAlan
): Promise<Sonuc<string>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { deger: null, error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, ad_soyad, rol").eq("email", user.email).single();
  if (!me) return { deger: null, error: "Kullanıcı bulunamadı." };

  const izinli = await rolGorebilirMi(supabase, me.rol, alan);
  if (!izinli) return { deger: null, error: "Bu bilgiyi görüntüleme yetkiniz yok." };

  const { data: satir } = await supabase.from(hedefTablo).select(alan).eq("id", hedefId).single();
  if (!satir) return { deger: null, error: "Kayıt bulunamadı." };

  await denetimKaydet(supabase, {
    kullaniciId: me.id, kullaniciAdSoyad: me.ad_soyad, rol: me.rol,
    hedefTablo, hedefId, alan,
  });

  let deger = (satir as any)[alan];
  if (alan === "dogum_tarihi" && deger) deger = new Date(deger).toLocaleDateString("tr-TR");
  return { deger: deger != null ? String(deger) : null };
}

export type BedenOlculeriSonucu = {
  beden_ceket: string | null;
  beden_pantolon: string | null;
  beden_gomlek: string | null;
  beden_tisort: string | null;
};

export async function bedenOlculeriGetir(personelId: string): Promise<Sonuc<BedenOlculeriSonucu>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { deger: null, error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, ad_soyad, rol").eq("email", user.email).single();
  if (!me) return { deger: null, error: "Kullanıcı bulunamadı." };

  const izinli = await rolGorebilirMi(supabase, me.rol, "beden_olculeri");
  if (!izinli) return { deger: null, error: "Bu bilgiyi görüntüleme yetkiniz yok." };

  const { data: satir } = await supabase
    .from("personel")
    .select("beden_ceket, beden_pantolon, beden_gomlek, beden_tisort")
    .eq("id", personelId)
    .single();
  if (!satir) return { deger: null, error: "Kayıt bulunamadı." };

  await denetimKaydet(supabase, {
    kullaniciId: me.id, kullaniciAdSoyad: me.ad_soyad, rol: me.rol,
    hedefTablo: "personel", hedefId: personelId, alan: "beden_olculeri",
  });

  return { deger: satir as BedenOlculeriSonucu };
}

export type BrutMaasSonucu = {
  brut_maas: number | null;
  brut_maas_hata: string | null;
  kidem_tazminati_tavani: number | null;
  kidem_tazminati_tahmini: number | null;
};

// Brüt maaş + kıdem tazminatı tahmini — tazminat tahmini maaşı geriye dönük
// hesaplanabilir kıldığı için ikisi birlikte, tek "brut_maas" iznine tabi.
export async function brutMaasGetir(personelId: string): Promise<Sonuc<BrutMaasSonucu>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { deger: null, error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, ad_soyad, rol").eq("email", user.email).single();
  if (!me) return { deger: null, error: "Kullanıcı bulunamadı." };

  const izinli = await rolGorebilirMi(supabase, me.rol, "brut_maas");
  if (!izinli) return { deger: null, error: "Bu bilgiyi görüntüleme yetkiniz yok." };

  const { data: personel } = await supabase
    .from("personel")
    .select("guncel_unvan, kidem_baslangic_tarihi")
    .eq("id", personelId)
    .single();
  if (!personel) return { deger: null, error: "Kayıt bulunamadı." };

  const { data: atamalar } = await supabase
    .from("personel_atama_gecmisi")
    .select("baslama_tarihi, ayrilma_tarihi")
    .eq("personel_id", personelId);

  const { data: ayar } = await supabase.from("sistem_ayarlari").select("kidem_tazminati_tavani").eq("id", 1).single();
  const tavan = ayar?.kidem_tazminati_tavani ?? null;

  let kidemAy: number | null = null;
  {
    const gecerliler = (atamalar ?? [])
      .filter((d: any) => d.baslama_tarihi)
      .map((d: any) => ({ baslama: new Date(d.baslama_tarihi), ayrilma: d.ayrilma_tarihi ? new Date(d.ayrilma_tarihi) : null }))
      .sort((a: any, b: any) => a.baslama.getTime() - b.baslama.getTime());
    if (gecerliler.length > 0) {
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
      kidemAy = Math.max((simdi.getFullYear() - donemBaslangic.getFullYear()) * 12 + (simdi.getMonth() - donemBaslangic.getMonth()), 0);
    }
  }

  let brutMaas: number | null = null;
  let brutMaasHata: string | null = null;
  if (personel.guncel_unvan) {
    const { data: tumUnvanMaaslar, error: unvanMaasHata } = await supabase.from("unvan_maas").select("unvan, brut_maas");
    if (unvanMaasHata) {
      brutMaasHata = unvanMaasHata.message;
    } else {
      const aranan = personel.guncel_unvan.trim().toLocaleUpperCase("tr-TR");
      const eslesen = (tumUnvanMaaslar ?? []).find((u: any) => u.unvan.trim().toLocaleUpperCase("tr-TR") === aranan);
      brutMaas = eslesen?.brut_maas ?? null;
    }
  }

  let kidemTazminatiTahmini: number | null = null;
  if (brutMaas != null && tavan != null && kidemAy != null) {
    const esasAlinanMaas = Math.min(brutMaas, tavan);
    kidemTazminatiTahmini = Math.round(esasAlinanMaas * (kidemAy / 12) * 100) / 100;
  }

  await denetimKaydet(supabase, {
    kullaniciId: me.id, kullaniciAdSoyad: me.ad_soyad, rol: me.rol,
    hedefTablo: "personel", hedefId: personelId, alan: "brut_maas",
  });

  return {
    deger: {
      brut_maas: brutMaas,
      brut_maas_hata: brutMaasHata,
      kidem_tazminati_tavani: tavan,
      kidem_tazminati_tahmini: kidemTazminatiTahmini,
    },
  };
}
