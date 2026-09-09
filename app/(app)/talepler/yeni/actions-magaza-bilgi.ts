"use server";

import { createClient } from "@/lib/supabase/server";

export type MagazaAylikSatiri = {
  yil: number; ay: number; hgo: number | null; adet_hgo: number | null;
  sepet_ortalamasi: number | null; sepet_derinligi: number | null;
  donusum_orani: number | null; giren_musteri_sayisi: number | null;
  toplam_ciro_kdv_dahil: number | null; satis_adeti: number | null;
};

export type MagazaBilgi = {
  magaza_adi: string;
  bolge_adi: string;
  magaza_muduru: string | null;
  ana_norm: number; ana_dolu: number;
  donemsel_norm: number; donemsel_dolu: number;
  part_norm: number; part_dolu: number;
  aylikVeri: MagazaAylikSatiri[];
  calisanlar: { ad_soyad: string; unvan: string | null; kategori: string | null; hgo: number | null }[];
};

// Yeni Talep formunda bir mağaza seçilince, o mağazanın norm/doluluk ve aylık
// performans geçmişini anlık (on-demand) getirir — tüm mağazaların verisini
// önceden yüklemek yerine sadece seçilen mağazanınki çekilir (performans için).
export async function getMagazaBilgi(magazaId: string): Promise<MagazaBilgi | null> {
  if (!magazaId) return null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: magaza } = await supabase
    .from("magazalar")
    .select("magaza_adi, bolgeler(ad), norm(ana_kadro_norm, donemsel_norm, part_time_norm)")
    .eq("id", magazaId)
    .single();
  if (!magaza) return null;

  const { data: personelListesi } = await supabase
    .from("personel")
    .select("id, kadro_kategorisi, guncel_unvan, ad_soyad, performans_ortalama_hgo")
    .eq("guncel_magaza_id", magazaId)
    .eq("durum", "aktif")
    .not("tc_kimlik_no", "like", "PLASIYER-%");

  const dolu = { ANA_KADRO: 0, DONEMSEL: 0, PART_TIME: 0 };
  let magazaMuduru: string | null = null;
  const MUDUR_UNVANLARI = ["mağaza müdürü", "havalimanı mağaza müdürü"];
  (personelListesi ?? []).forEach((p: any) => {
    if (p.kadro_kategorisi === "ANA_KADRO" || p.kadro_kategorisi === "DONEMSEL" || p.kadro_kategorisi === "PART_TIME") {
      dolu[p.kadro_kategorisi as "ANA_KADRO" | "DONEMSEL" | "PART_TIME"]++;
    }
    if (p.guncel_unvan && MUDUR_UNVANLARI.includes(String(p.guncel_unvan).trim().toLocaleLowerCase("tr-TR"))) {
      magazaMuduru = p.ad_soyad;
    }
  });

  const { data: aylikVeriHam } = await supabase
    .from("performans_magaza_aylik")
    .select("yil, ay, hgo, adet_hgo, sepet_ortalamasi, sepet_derinligi, donusum_orani, giren_musteri_sayisi, toplam_ciro_kdv_dahil, satis_adeti")
    .eq("magaza_id", magazaId)
    .order("yil", { ascending: true })
    .order("ay", { ascending: true });

  const normSatiri = Array.isArray(magaza.norm) ? magaza.norm[0] : (magaza.norm as any);

  const calisanlar = (personelListesi ?? [])
    .map((p: any) => ({
      ad_soyad: p.ad_soyad, unvan: p.guncel_unvan, kategori: p.kadro_kategorisi,
      hgo: p.performans_ortalama_hgo,
    }))
    .sort((a, b) => (b.hgo ?? -Infinity) - (a.hgo ?? -Infinity));

  return {
    magaza_adi: magaza.magaza_adi,
    bolge_adi: (magaza.bolgeler as any)?.ad ?? "",
    magaza_muduru: magazaMuduru,
    ana_norm: normSatiri?.ana_kadro_norm ?? 0, ana_dolu: dolu.ANA_KADRO,
    donemsel_norm: normSatiri?.donemsel_norm ?? 0, donemsel_dolu: dolu.DONEMSEL,
    part_norm: normSatiri?.part_time_norm ?? 0, part_dolu: dolu.PART_TIME,
    aylikVeri: (aylikVeriHam ?? []) as MagazaAylikSatiri[],
    calisanlar,
  };
}
