"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ProfilBilgisi = {
  ad_soyad: string;
  email: string;
  rol: string;
  dogum_tarihi: string | null;
  egitim_duzeyi: string | null;
  okul: string | null;
  bolum: string | null;
  telefon: string | null;
  adres: string | null;
  profil_foto_url: string | null;
  magazalar: string[];
  sertifikalar: { id: string; sertifika_adi: string }[];
  yillik_izin_hakki: number;
  kullanilan_izin_gun: number;
  bekleyenTalep: { id: string; created_at: string } | null;
  // Akademi Kiğılı — entegrasyon henüz aktif değil, alanlar hazır ama boş.
  akademi: { sonGirisTarihi: string | null; toplamIzlenenEgitim: number; sonUcEgitim: string[] };
};

async function benimKullanicim() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, me: null };
  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  return { supabase, me };
}

export async function getBenimProfilim(): Promise<ProfilBilgisi | null> {
  const { supabase, me } = await benimKullanicim();
  if (!me) return null;

  const { data: kullanici } = await supabase
    .from("kullanicilar")
    .select("ad_soyad, email, rol, dogum_tarihi, egitim_duzeyi, okul, bolum, telefon, adres, profil_foto_url, yillik_izin_hakki, kullanilan_izin_gun")
    .eq("id", me.id)
    .single();
  if (!kullanici) return null;

  let magazaAdlari: string[] = [];
  if (me.rol === "YONETIM") {
    magazaAdlari = ["Tüm Mağazalar"];
  } else {
    const { data: bolgeler } = await supabase.from("kullanici_bolge_atama").select("bolge_id").eq("kullanici_id", me.id);
    const bolgeIdleri = (bolgeler ?? []).map((b: any) => b.bolge_id);
    if (bolgeIdleri.length > 0) {
      const { data: magazalar } = await supabase.from("magazalar").select("magaza_adi").in("bolge_id", bolgeIdleri).eq("aktif", true).order("magaza_adi");
      magazaAdlari = (magazalar ?? []).map((m: any) => m.magaza_adi);
    }
  }

  const { data: sertifikalar } = await supabase.from("kullanici_sertifikalar").select("id, sertifika_adi").eq("kullanici_id", me.id).order("created_at");

  const { data: bekleyen } = await supabase
    .from("kullanici_profil_talepleri")
    .select("id, created_at")
    .eq("kullanici_id", me.id)
    .eq("durum", "BEKLEMEDE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ad_soyad: kullanici.ad_soyad, email: kullanici.email, rol: kullanici.rol,
    dogum_tarihi: kullanici.dogum_tarihi, egitim_duzeyi: kullanici.egitim_duzeyi,
    okul: kullanici.okul, bolum: kullanici.bolum, telefon: kullanici.telefon, adres: kullanici.adres,
    profil_foto_url: kullanici.profil_foto_url,
    magazalar: magazaAdlari,
    sertifikalar: sertifikalar ?? [],
    yillik_izin_hakki: kullanici.yillik_izin_hakki ?? 14,
    kullanilan_izin_gun: kullanici.kullanilan_izin_gun ?? 0,
    bekleyenTalep: bekleyen ?? null,
    // Akademi Kiğılı entegrasyonu henüz aktif değil — sayfada bölüm
    // görünür kalsın diye boş/varsayılan değerlerle hazır tutuluyor.
    akademi: { sonGirisTarihi: null, toplamIzlenenEgitim: 0, sonUcEgitim: [] },
  };
}

export type ProfilDegisiklikPaketi = {
  telefon: string | null;
  egitim_duzeyi: string | null;
  okul: string | null;
  bolum: string | null;
  adres: string | null;
  email: string | null;
  profil_foto_url: string | null;
  sertifikalar: string[]; // tam liste — talep onaylanınca eskisinin yerine geçer
};

// Doğrudan güncellemek yerine, bir ONAY TALEBİ oluşturur — Bordro
// onaylayana kadar hiçbir alan gerçekten değişmez.
export async function profilDegisiklikTalebiGonder(paket: ProfilDegisiklikPaketi): Promise<{ error?: string }> {
  const { supabase, me } = await benimKullanicim();
  if (!me) return { error: "Giriş yapmalısınız." };

  const { data: mevcutBekleyen } = await supabase
    .from("kullanici_profil_talepleri")
    .select("id")
    .eq("kullanici_id", me.id)
    .eq("durum", "BEKLEMEDE")
    .maybeSingle();
  if (mevcutBekleyen) return { error: "Zaten onay bekleyen bir değişiklik talebiniz var — o karara bağlanmadan yeni talep gönderemezsiniz." };

  const { error } = await supabase.from("kullanici_profil_talepleri").insert({ kullanici_id: me.id, yeni_veri: paket });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/onay-bekleyenler");
  return {};
}

// Profil fotoğrafı hemen depoya yüklenir (dosya yükleme "beklemede"
// tutulamaz), ama YENİ url'nin kullanıcıya asıl ait olarak GÖRÜNMESİ,
// diğer alanlarla birlikte yine Bordro onayına tabi olur — bu fonksiyon
// sadece dosyayı yükleyip bir url döner, kullanicilar.profil_foto_url'i
// DEĞİŞTİRMEZ (bunu profilDegisiklikTalebiGonder, onay sonrası uygular).
export async function profilFotoYukle(formData: FormData): Promise<{ url?: string; error?: string }> {
  const { supabase, me } = await benimKullanicim();
  if (!me) return { error: "Giriş yapmalısınız." };

  const dosya = formData.get("dosya") as File | null;
  if (!dosya || dosya.size === 0) return { error: "Dosya seçilmedi." };
  if (dosya.size > 5 * 1024 * 1024) return { error: "Dosya en fazla 5 MB olabilir." };

  const uzanti = dosya.name.split(".").pop() ?? "jpg";
  const yol = `${me.id}/${Date.now()}.${uzanti}`;
  const { error: yuklemeHata } = await supabase.storage.from("profil-fotograflari").upload(yol, dosya, { contentType: dosya.type });
  if (yuklemeHata) return { error: yuklemeHata.message };

  const { data } = supabase.storage.from("profil-fotograflari").getPublicUrl(yol);
  return { url: data.publicUrl };
}

// --- Bordro tarafı: onay bekleyen profil taleplerini listeleme/karar --- //

export type BekleyenProfilTalebi = {
  id: string;
  kullanici_id: string;
  ad_soyad: string;
  rol: string;
  yeni_veri: ProfilDegisiklikPaketi;
  created_at: string;
};

export async function getBekleyenProfilTalepleri(): Promise<BekleyenProfilTalebi[]> {
  const { supabase, me } = await benimKullanicim();
  if (!me || (me.rol !== "BORDRO" && me.rol !== "YONETIM")) return [];

  const { data } = await supabase
    .from("kullanici_profil_talepleri")
    .select("id, kullanici_id, yeni_veri, created_at, kullanicilar!kullanici_id(ad_soyad, rol)")
    .eq("durum", "BEKLEMEDE")
    .order("created_at", { ascending: true });

  return (data ?? []).map((t: any) => ({
    id: t.id, kullanici_id: t.kullanici_id, yeni_veri: t.yeni_veri, created_at: t.created_at,
    ad_soyad: t.kullanicilar?.ad_soyad ?? "—", rol: t.kullanicilar?.rol ?? "—",
  }));
}

export async function profilDegisiklikOnayla(talepId: string): Promise<{ error?: string }> {
  const { supabase, me } = await benimKullanicim();
  if (!me || (me.rol !== "BORDRO" && me.rol !== "YONETIM")) return { error: "Yetkiniz yok." };

  const { data: talep } = await supabase.from("kullanici_profil_talepleri").select("kullanici_id, yeni_veri").eq("id", talepId).single();
  if (!talep) return { error: "Talep bulunamadı." };

  const p = talep.yeni_veri as ProfilDegisiklikPaketi;
  const { error: guncelleHata } = await supabase
    .from("kullanicilar")
    .update({
      telefon: p.telefon, egitim_duzeyi: p.egitim_duzeyi, okul: p.okul, bolum: p.bolum,
      adres: p.adres, email: p.email ?? undefined, profil_foto_url: p.profil_foto_url,
    })
    .eq("id", talep.kullanici_id);
  if (guncelleHata) return { error: guncelleHata.message };

  await supabase.from("kullanici_sertifikalar").delete().eq("kullanici_id", talep.kullanici_id);
  if (p.sertifikalar && p.sertifikalar.length > 0) {
    await supabase.from("kullanici_sertifikalar").insert(p.sertifikalar.map((s) => ({ kullanici_id: talep.kullanici_id, sertifika_adi: s })));
  }

  await supabase.from("kullanici_profil_talepleri").update({ durum: "ONAYLANDI", onaylayan_kullanici_id: me.id, karar_tarihi: new Date().toISOString() }).eq("id", talepId);

  revalidatePath("/onay-bekleyenler");
  return {};
}

export async function profilDegisiklikReddet(talepId: string, neden: string): Promise<{ error?: string }> {
  const { supabase, me } = await benimKullanicim();
  if (!me || (me.rol !== "BORDRO" && me.rol !== "YONETIM")) return { error: "Yetkiniz yok." };

  const { error } = await supabase
    .from("kullanici_profil_talepleri")
    .update({ durum: "REDDEDILDI", red_nedeni: neden, onaylayan_kullanici_id: me.id, karar_tarihi: new Date().toISOString() })
    .eq("id", talepId);
  if (error) return { error: error.message };

  revalidatePath("/onay-bekleyenler");
  return {};
}
