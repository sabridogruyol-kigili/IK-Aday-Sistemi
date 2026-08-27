"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

type Sonuc = { error?: string; norm_uyari?: string; basarili?: boolean };
type PozisyonSatiri = { pozisyon_tipi: string; kisi_sayisi: number };

export async function createIseAlimTalebiToplu(formData: FormData): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return { error: "Kullanıcı bulunamadı." };

  const magazaId = String(formData.get("magaza_id") ?? "").trim();
  const israrli = formData.get("israrli") === "true";
  const aciklama = String(formData.get("aciklama") ?? "").trim();
  const pozisyonlarJson = String(formData.get("pozisyonlar") ?? "[]");

  if (!magazaId) return { error: "Mağaza seçimi zorunlu." };

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

  const unvanlar = pozisyonlar.map((p) => p.pozisyon_tipi);

  // Bağımsız sorguları paralel çalıştır (mağaza, norm, ünvan-kategori eşlemesi) — sıralı yerine tek turda.
  const [{ data: unvanlarHam }, { data: magaza }, { data: norm }] = await Promise.all([
    supabase.from("unvan_kadro_kategorisi").select("unvan, kategori").in("unvan", unvanlar),
    supabase.from("magazalar").select("bolge_id").eq("id", magazaId).single(),
    supabase.from("norm").select("ana_kadro_norm, donemsel_norm, part_time_norm").eq("magaza_id", magazaId).single(),
  ]);

  const kategoriMap: Record<string, string> = {};
  (unvanlarHam ?? []).forEach((u: any) => { kategoriMap[u.unvan] = u.kategori; });
  for (const p of pozisyonlar) {
    if (!kategoriMap[p.pozisyon_tipi]) return { error: `Tanınmayan pozisyon tipi: ${p.pozisyon_tipi}` };
  }
  if (!magaza) return { error: "Mağaza bulunamadı." };

  const talepEdilenKategori: Record<string, number> = { ANA_KADRO: 0, DONEMSEL: 0, PART_TIME: 0 };
  pozisyonlar.forEach((p) => {
    const kat = kategoriMap[p.pozisyon_tipi];
    talepEdilenKategori[kat] += p.kisi_sayisi;
  });
  const kategoriler = (["ANA_KADRO", "DONEMSEL", "PART_TIME"] as const).filter((k) => talepEdilenKategori[k] > 0);
  const KATEGORI_LABEL: Record<string, string> = { ANA_KADRO: "Ana Kadro", DONEMSEL: "Dönemsel", PART_TIME: "Part Time" };

  // Her kategori için norm kontrolünü (3 alt sorgu x kategori sayısı) TEK Promise.all turunda paralel yap.
  const kategoriSonuclari = await Promise.all(
    kategoriler.map(async (kategori) => {
      const [{ count: aktifSayisi }, { data: kategoriUnvanlariHam }] = await Promise.all([
        supabase.from("personel").select("*", { count: "exact", head: true })
          .eq("guncel_magaza_id", magazaId).eq("durum", "aktif").eq("kadro_kategorisi", kategori),
        supabase.from("unvan_kadro_kategorisi").select("unvan").eq("kategori", kategori),
      ]);
      const kategoriPozisyonlari = (kategoriUnvanlariHam ?? []).map((u) => u.unvan);
      const { data: bekleyenTalepler } = await supabase
        .from("talepler")
        .select("kisi_sayisi")
        .eq("magaza_id", magazaId)
        .eq("talep_turu", "ISE_ALIM")
        .in("durum", ["BEKLEMEDE", "ISLEME_DEVAM", "DURAKLADI"])
        .in("pozisyon_tipi", kategoriPozisyonlari.length > 0 ? kategoriPozisyonlari : ["__yok__"]);

      const toplamNorm =
        kategori === "ANA_KADRO" ? norm?.ana_kadro_norm ?? 0
        : kategori === "DONEMSEL" ? norm?.donemsel_norm ?? 0
        : norm?.part_time_norm ?? 0;
      const bekleyenKisiSayisi = (bekleyenTalepler ?? []).reduce((s, t) => s + (t.kisi_sayisi ?? 0), 0);
      const doluSayi = (aktifSayisi ?? 0) + bekleyenKisiSayisi;
      const kalanKontenjan = toplamNorm - doluSayi;
      const asimVarMi = talepEdilenKategori[kategori] > kalanKontenjan;
      return { kategori, toplamNorm, doluSayi, kalanKontenjan, asimVarMi };
    })
  );

  const asimlar = kategoriSonuclari
    .filter((k) => k.asimVarMi)
    .map((k) => `${KATEGORI_LABEL[k.kategori]}: norm ${k.toplamNorm}, dolu+bekleyen ${k.doluSayi}, kalan ${k.kalanKontenjan}, talep edilen ${talepEdilenKategori[k.kategori]}`);

  if (asimlar.length > 0 && !israrli) {
    return { norm_uyari: "Norm yetersiz:\n" + asimlar.join("\n") };
  }
  if (asimlar.length > 0 && israrli && aciklama.length < 100) {
    return { error: "Norm aşıldığı için en az 100 karakterlik açıklama girmeniz zorunlu." };
  }

  // Onaylayıcı listesini (BM/İK/Yönetim kullanıcı id'leri) TEK SEFER hesapla — tüm pozisyonlar için aynı liste kullanılacak,
  // her pozisyon başına tekrar tekrar sorgu atmak yerine.
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
          .eq("bolge_id", magaza.bolge_id)
          .eq("kullanicilar.rol", rol)
          .eq("kullanicilar.aktif", true);
        (bolgeliler ?? []).forEach((b: any) => onaylayiciListesi.push({ kullanici_id: b.kullanici_id, rol_baglami: rol }));
      }
    })
  );

  const grupId = randomUUID();
  const { data: anaTalepNo } = await supabase.rpc("sonraki_talep_no");
  if (!anaTalepNo) return { error: "Talep numarası üretilemedi." };

  const norm_kontrol_sonucu = asimlar.length > 0 ? "UYGUN_DEGIL_ISRARLI" : "UYGUN";

  // Talepleri TOPLU insert et (her pozisyon için ayrı ayrı sorgu atmak yerine tek seferde).
  const talepSatirlari = pozisyonlar.map((p, i) => ({
    talep_no: pozisyonlar.length > 1 ? `${anaTalepNo}-${i + 1}` : anaTalepNo,
    talep_turu: "ISE_ALIM",
    magaza_id: magazaId,
    acan_kullanici_id: me.id,
    acan_rol: me.rol,
    pozisyon_tipi: p.pozisyon_tipi,
    kisi_sayisi: p.kisi_sayisi,
    durum: "BEKLEMEDE",
    aktif_gonderim_no: 1,
    magaza_grup_id: pozisyonlar.length > 1 ? grupId : null,
  }));

  const { data: yeniTalepler, error: talepHata } = await supabase.from("talepler").insert(talepSatirlari).select("id");
  if (talepHata || !yeniTalepler || yeniTalepler.length !== talepSatirlari.length) {
    return { error: "Talepler oluşturulamadı: " + talepHata?.message };
  }

  const gonderimSatirlari = yeniTalepler.map((t) => ({
    talep_id: t.id,
    gonderim_no: 1,
    aciklama: aciklama || null,
    norm_kontrol_sonucu,
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
