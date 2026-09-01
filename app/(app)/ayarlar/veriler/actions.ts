"use server";

import { createClient } from "@/lib/supabase/server";

const SAYFA_BOYUTU = 50;

async function yonetimMi() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  return me?.rol === "YONETIM";
}

export async function getPersonelSayfa(sayfa: number, arama: string) {
  if (!(await yonetimMi())) return { satirlar: [], toplam: 0 };
  const supabase = createClient();
  const bas = sayfa * SAYFA_BOYUTU;

  let sorgu = supabase
    .from("personel")
    .select("id, personel_kodu, tc_kimlik_no, ad_soyad, guncel_unvan, kadro_kategorisi, durum, performans_ortalama_hgo, magazalar(magaza_adi, magaza_kodu)", { count: "exact" })
    .order("ad_soyad")
    .range(bas, bas + SAYFA_BOYUTU - 1);

  if (arama.trim()) {
    sorgu = sorgu.or(`ad_soyad.ilike.%${arama}%,tc_kimlik_no.ilike.%${arama}%,personel_kodu.ilike.%${arama}%`);
  }

  const { data, count } = await sorgu;
  return { satirlar: data ?? [], toplam: count ?? 0 };
}

export async function getPerformansKisiSayfa(sayfa: number, arama: string) {
  if (!(await yonetimMi())) return { satirlar: [], toplam: 0 };
  const supabase = createClient();
  const bas = sayfa * SAYFA_BOYUTU;

  let sorgu = supabase
    .from("performans_kisi_aylik")
    .select("id, yil, ay, hedef_ciro_kdv_dahil, gerceklesen_ciro_kdv_dahil, hgo, personel(ad_soyad, personel_kodu)", { count: "exact" })
    .order("yil", { ascending: false })
    .order("ay", { ascending: false })
    .range(bas, bas + SAYFA_BOYUTU - 1);

  const { data, count } = await sorgu;

  let satirlar = data ?? [];
  if (arama.trim()) {
    const q = arama.toLocaleLowerCase("tr-TR");
    satirlar = satirlar.filter((s: any) =>
      s.personel?.ad_soyad?.toLocaleLowerCase("tr-TR").includes(q) || s.personel?.personel_kodu?.toLocaleLowerCase("tr-TR").includes(q)
    );
  }

  return { satirlar, toplam: count ?? 0 };
}

export async function getPerformansMagazaSayfa(sayfa: number, arama: string) {
  if (!(await yonetimMi())) return { satirlar: [], toplam: 0 };
  const supabase = createClient();
  const bas = sayfa * SAYFA_BOYUTU;

  const sorgu = supabase
    .from("performans_magaza_aylik")
    .select("id, yil, ay, hgo, sepet_ortalamasi, sepet_derinligi, donusum_orani, giren_musteri_sayisi, magazalar(magaza_adi, magaza_kodu)", { count: "exact" })
    .order("yil", { ascending: false })
    .order("ay", { ascending: false })
    .range(bas, bas + SAYFA_BOYUTU - 1);

  const { data, count } = await sorgu;

  let satirlar = data ?? [];
  if (arama.trim()) {
    const q = arama.toLocaleLowerCase("tr-TR");
    satirlar = satirlar.filter((s: any) =>
      s.magazalar?.magaza_adi?.toLocaleLowerCase("tr-TR").includes(q) || s.magazalar?.magaza_kodu?.toLocaleLowerCase("tr-TR").includes(q)
    );
  }

  return { satirlar, toplam: count ?? 0 };
}
