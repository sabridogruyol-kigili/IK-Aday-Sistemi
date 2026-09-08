"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type Sonuc = { error?: string };

export async function createNormDegisiklikTalebi(formData: FormData): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("kullanicilar")
    .select("id, rol")
    .eq("email", user.email)
    .single();
  if (!me) return { error: "Kullanıcı bulunamadı." };

  const magazaId = String(formData.get("magaza_id") ?? "");
  const kategori = String(formData.get("norm_kategorisi") ?? "");
  const yeniDeger = parseInt(String(formData.get("norm_yeni_deger") ?? ""), 10);
  const aciklama = String(formData.get("aciklama") ?? "").trim();

  if (!magazaId || !["ANA_KADRO", "DONEMSEL", "PART_TIME"].includes(kategori) || isNaN(yeniDeger) || yeniDeger < 0) {
    return { error: "Mağaza, kategori ve geçerli bir yeni norm sayısı zorunlu." };
  }
  if (!aciklama) {
    return { error: "Açıklama zorunlu." };
  }

  const { data: normSatiri } = await supabase
    .from("norm")
    .select("ana_kadro_norm, donemsel_norm, part_time_norm")
    .eq("magaza_id", magazaId)
    .single();

  const eskiDeger =
    kategori === "ANA_KADRO" ? normSatiri?.ana_kadro_norm ?? 0
    : kategori === "DONEMSEL" ? normSatiri?.donemsel_norm ?? 0
    : normSatiri?.part_time_norm ?? 0;

  if (yeniDeger === eskiDeger) {
    return { error: "Yeni değer mevcut normla aynı — değişiklik yok." };
  }

  const { data: talepNo } = await supabase.rpc("sonraki_talep_no");
  if (!talepNo) return { error: "Talep numarası üretilemedi." };

  const { data: yeniTalep, error: talepHata } = await supabase
    .from("talepler")
    .insert({
      talep_no: talepNo,
      talep_turu: "NORM_DEGISIKLIK",
      magaza_id: magazaId,
      acan_kullanici_id: me.id,
      acan_rol: me.rol,
      norm_kategorisi: kategori,
      norm_eski_deger: eskiDeger,
      norm_yeni_deger: yeniDeger,
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
      aciklama,
    })
    .select("id")
    .single();
  if (gonderimHata || !gonderim) return { error: "Gönderim kaydı oluşturulamadı." };

  const { data: magaza } = await supabase
    .from("magazalar")
    .select("bolge_id")
    .eq("id", magazaId)
    .single();

  // Onaylayıcılar: açan hariç BM/İK/YÖNETİM (bölge bazlı, İşe Alım'daki gibi)
  // + Mağazalar Direktörlüğü (bölge sınırı olmadan, tüm aktif direktörler).
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

  // Mağazalar Direktörlüğü — açan bu rolde olamayacağı için (talep açma yetkisi
  // yok) her zaman eklenir, bölge sınırı yoktur.
  const { data: direktorler } = await supabase
    .from("kullanicilar").select("id").eq("rol", "MAGAZALAR_DIREKTORLUGU").eq("aktif", true);
  (direktorler ?? []).forEach((d: any) =>
    onaySatirlari.push({ gonderim_id: gonderim.id, onaylayici_kullanici_id: d.id, onaylayici_rol_baglami: "MAGAZALAR_DIREKTORLUGU" })
  );

  if (onaySatirlari.length > 0) {
    await supabase.from("talep_onaylari").insert(onaySatirlari);
  }

  revalidatePath("/talepler");
  redirect("/talepler");
}
