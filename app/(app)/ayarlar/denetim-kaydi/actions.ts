"use server";

import { createClient } from "@/lib/supabase/server";
import { HASSAS_ALAN_ETIKET, type HassasAlan } from "@/lib/hassasVeri";

const SAYFA_BOYUTU = 50;

export type DenetimKaydiSatiri = {
  id: string;
  kullanici_ad_soyad: string | null;
  rol: string | null;
  hedef_tablo: string | null;
  hedef_id: string | null;
  alan: string | null;
  alan_etiket: string;
  created_at: string;
};

export async function getDenetimKaydi(params: {
  sayfa: number; arama?: string; alan?: string;
}): Promise<{ satirlar: DenetimKaydiSatiri[]; toplam: number }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { satirlar: [], toplam: 0 };

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { satirlar: [], toplam: 0 };

  let sorgu = supabase
    .from("denetim_kaydi")
    .select("id, kullanici_ad_soyad, rol, hedef_tablo, hedef_id, alan, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.arama) sorgu = sorgu.ilike("kullanici_ad_soyad", `%${params.arama}%`);
  if (params.alan) sorgu = sorgu.eq("alan", params.alan);

  const bas = params.sayfa * SAYFA_BOYUTU;
  const { data, count } = await sorgu.range(bas, bas + SAYFA_BOYUTU - 1);

  return {
    satirlar: (data ?? []).map((d: any) => ({
      ...d,
      alan_etiket: HASSAS_ALAN_ETIKET[d.alan as HassasAlan] ?? d.alan ?? "—",
    })),
    toplam: count ?? 0,
  };
}
