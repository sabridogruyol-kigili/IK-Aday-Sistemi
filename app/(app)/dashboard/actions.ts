"use server";

import { createClient } from "@/lib/supabase/server";

export type MagazaCalisanSatiri = {
  personel_id: string;
  yil: number;
  ay: number;
  hgo: number | null;
  gerceklesen_ciro_kdv_dahil: number | null;
  ad_soyad: string;
  guncel_unvan: string | null;
};

// Dashboard'da bir mağaza seçildiğinde, o mağazanın TÜM personelinin aylık
// performans geçmişini anlık çeker. Tüm şirketin geçmişini önceden yüklemek
// (binlerce personel × onlarca ay) sayfa yüklenişini ciddi yavaşlattığı için,
// bu bilgi artık sadece ihtiyaç duyulduğunda (bir mağaza seçilince) çekiliyor.
export async function getMagazaCalisanGecmisi(magazaId: string): Promise<MagazaCalisanSatiri[]> {
  if (!magazaId) return [];
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("performans_kisi_aylik")
    .select("personel_id, yil, ay, hgo, gerceklesen_ciro_kdv_dahil, personel!inner(ad_soyad, guncel_unvan, guncel_magaza_id)")
    .eq("personel.guncel_magaza_id", magazaId);

  return (data ?? []).map((s: any) => ({
    personel_id: s.personel_id,
    yil: s.yil,
    ay: s.ay,
    hgo: s.hgo,
    gerceklesen_ciro_kdv_dahil: s.gerceklesen_ciro_kdv_dahil,
    ad_soyad: s.personel?.ad_soyad ?? "",
    guncel_unvan: s.personel?.guncel_unvan ?? null,
  }));
}
