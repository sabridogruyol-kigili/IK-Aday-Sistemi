"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

type Sonuc = { error?: string; basarili?: boolean };

type PozisyonSatiri = { pozisyon_tipi: string; kisi_sayisi: number };

export async function createYeniMagazaTalebi(formData: FormData): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return { error: "Kullanıcı bulunamadı." };

  const magazaKoduGirilen = String(formData.get("magaza_kodu") ?? "").trim();
  const magazaAdi = String(formData.get("magaza_adi") ?? "").trim();
  const bolgeId = String(formData.get("bolge_id") ?? "").trim();
  const aciklama = String(formData.get("aciklama") ?? "").trim();
  const pozisyonlarJson = String(formData.get("pozisyonlar") ?? "[]");

  if (!magazaAdi || !bolgeId) {
    return { error: "Mağaza Adı ve Bölge zorunlu." };
  }

  let pozisyonlar: PozisyonSatiri[] = [];
  try {
    pozisyonlar = JSON.parse(pozisyonlarJson);
  } catch {
    return { error: "Pozisyon listesi okunamadı." };
  }
  if (!Array.isArray(pozisyonlar) || pozisyonlar.length === 0) {
    return { error: "En az bir pozisyon eklemelisiniz." };
  }
  for (const p of pozisyonlar) {
    if (!p.pozisyon_tipi || !p.kisi_sayisi || p.kisi_sayisi < 1) {
      return { error: "Her pozisyon satırında ünvan ve en az 1 kişi sayısı olmalı." };
    }
  }

  // Mağaza Kodu girilmemişse otomatik üret (POPUP-<rastgele 5 haneli> formatında,
  // çakışma ihtimaline karşı birkaç kez dener). Girilmişse aynı kodda mağaza olup olmadığını kontrol et.
  let magazaKodu = magazaKoduGirilen;
  if (!magazaKodu) {
    for (let deneme = 0; deneme < 10; deneme++) {
      const aday = `POPUP-${Math.floor(10000 + Math.random() * 90000)}`;
      const { data: cakisan } = await supabase.from("magazalar").select("id").eq("magaza_kodu", aday).maybeSingle();
      if (!cakisan) { magazaKodu = aday; break; }
    }
    if (!magazaKodu) return { error: "Otomatik mağaza kodu üretilemedi, lütfen elle bir kod girin." };
  } else {
    const { data: mevcutMagaza } = await supabase
      .from("magazalar")
      .select("id")
      .eq("magaza_kodu", magazaKodu)
      .maybeSingle();
    if (mevcutMagaza) {
      return { error: `Mağaza Kodu (${magazaKodu}) sistemde zaten kayıtlı. Bu akış sadece yeni mağaza/çadır/pop-up açılışları içindir — mevcut mağaza için normal İşe Alım Talebi kullanın.` };
    }
  }

  // Ünvan -> kategori eşlemesi
  const unvanlar = pozisyonlar.map((p) => p.pozisyon_tipi);
  const { data: unvanlarHam } = await supabase
    .from("unvan_kadro_kategorisi")
    .select("unvan, kategori")
    .in("unvan", unvanlar);
  const kategoriMap: Record<string, string> = {};
  (unvanlarHam ?? []).forEach((u: any) => { kategoriMap[u.unvan] = u.kategori; });

  for (const p of pozisyonlar) {
    if (!kategoriMap[p.pozisyon_tipi]) {
      return { error: `Tanınmayan pozisyon tipi: ${p.pozisyon_tipi}` };
    }
  }

  // 1) Mağazayı oluştur
  const { data: yeniMagaza, error: magazaHata } = await supabase
    .from("magazalar")
    .insert({ magaza_kodu: magazaKodu, magaza_adi: magazaAdi, bolge_id: bolgeId, aktif: true })
    .select("id")
    .single();
  if (magazaHata || !yeniMagaza) return { error: "Mağaza oluşturulamadı: " + magazaHata?.message };

  // 2) Norm baseline'ını, talep edilen kişi sayılarının toplamı olarak kur
  //    (yeni açılan mağaza için henüz Excel'den norm gelmedi, talep edilen = norm kabul edilir)
  const normToplam: Record<string, number> = { ANA_KADRO: 0, DONEMSEL: 0, PART_TIME: 0 };
  pozisyonlar.forEach((p) => {
    const kat = kategoriMap[p.pozisyon_tipi];
    if (kat === "ANA_KADRO" || kat === "DONEMSEL" || kat === "PART_TIME") {
      normToplam[kat] += p.kisi_sayisi;
    }
  });

  const { error: normHata } = await supabase.from("norm").insert({
    magaza_id: yeniMagaza.id,
    ana_kadro_norm: normToplam.ANA_KADRO,
    donemsel_norm: normToplam.DONEMSEL,
    part_time_norm: normToplam.PART_TIME,
    kaynak: "yeni_magaza_talebi",
    guncelleyen_kullanici_id: me.id,
  });
  if (normHata) return { error: "Norm baseline oluşturulamadı: " + normHata.message };

  // 3) Ortak grup id + ana talep numarası, her pozisyon için "-N" ekiyle alt talep no
  const grupId = randomUUID();
  const { data: anaTalepNo } = await supabase.rpc("sonraki_talep_no");
  if (!anaTalepNo) return { error: "Talep numarası üretilemedi." };

  // Onaylayıcı listesini (BM/İK/Yönetim) TEK SEFER hesapla — her pozisyon için tekrar sorgu atmak yerine.
  const onayRolleri = (["BM", "IK", "YONETIM"] as const).filter((r) => r !== me.rol);
  const onaylayiciListesi: { kullanici_id: string; rol_baglami: string }[] = [];

  await Promise.all(
    onayRolleri.map(async (rol) => {
      if (rol === "YONETIM") {
        const { data: yonetimler } = await supabase.from("kullanicilar").select("id").eq("rol", "YONETIM").eq("aktif", true);
        (yonetimler ?? []).forEach((y) => onaylayiciListesi.push({ kullanici_id: y.id, rol_baglami: "YONETIM" }));
      } else {
        const { data: bolgeliler } = await supabase
          .from("kullanici_bolge_atama")
          .select("kullanici_id, kullanicilar!inner(rol, aktif)")
          .eq("bolge_id", bolgeId)
          .eq("kullanicilar.rol", rol)
          .eq("kullanicilar.aktif", true);
        (bolgeliler ?? []).forEach((b: any) => onaylayiciListesi.push({ kullanici_id: b.kullanici_id, rol_baglami: rol }));
      }
    })
  );

  // Talepleri TOPLU insert et
  const talepSatirlari = pozisyonlar.map((p, i) => ({
    talep_no: `${anaTalepNo}-${i + 1}`,
    talep_turu: "ISE_ALIM",
    magaza_id: yeniMagaza.id,
    acan_kullanici_id: me.id,
    acan_rol: me.rol,
    pozisyon_tipi: p.pozisyon_tipi,
    kisi_sayisi: p.kisi_sayisi,
    durum: "BEKLEMEDE",
    aktif_gonderim_no: 1,
    magaza_grup_id: grupId,
  }));
  const { data: yeniTalepler, error: talepHata } = await supabase.from("talepler").insert(talepSatirlari).select("id");
  if (talepHata || !yeniTalepler || yeniTalepler.length !== talepSatirlari.length) {
    return { error: "Talepler oluşturulamadı: " + talepHata?.message };
  }

  const gonderimSatirlari = yeniTalepler.map((t) => ({
    talep_id: t.id,
    gonderim_no: 1,
    aciklama: aciklama || `Yeni mağaza/çadır/pop-up açılışı: ${magazaAdi} (${magazaKodu})`,
    norm_kontrol_sonucu: "UYGUN",
  }));
  const { data: yeniGonderimler, error: gonderimHata } = await supabase.from("talep_gonderimler").insert(gonderimSatirlari).select("id");
  if (gonderimHata || !yeniGonderimler) return { error: "Gönderim kayıtları oluşturulamadı: " + gonderimHata?.message };

  const onaySatirlari = yeniGonderimler.flatMap((g) =>
    onaylayiciListesi.map((o) => ({
      gonderim_id: g.id,
      onaylayici_kullanici_id: o.kullanici_id,
      onaylayici_rol_baglami: o.rol_baglami,
    }))
  );
  if (onaySatirlari.length > 0) {
    await supabase.from("talep_onaylari").insert(onaySatirlari);
  }

  revalidatePath("/talepler");
  revalidatePath("/norm");
  revalidatePath("/dashboard");
  return { basarili: true };
}
