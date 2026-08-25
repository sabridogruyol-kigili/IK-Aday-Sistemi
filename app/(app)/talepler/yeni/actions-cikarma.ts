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
    .select("id, ad_soyad, guncel_magaza_id, kadro_kategorisi")
    .eq("id", personelId)
    .single();
  if (!personel) return { error: "Personel bulunamadı." };

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
    if (!uygun && israrli && !aciklama) {
      return { error: "Norm aşıldığı için açıklama girmeniz zorunlu." };
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

  for (const rol of onayRolleri) {
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
  }

  if (onaySatirlari.length > 0) {
    await supabase.from("talep_onaylari").insert(onaySatirlari);
  }

  revalidatePath("/talepler");
  redirect("/talepler");
}
