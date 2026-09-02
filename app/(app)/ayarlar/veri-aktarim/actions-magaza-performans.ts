"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

// Tasarım notu 3.2'deki kadro kategorisi eşlemesindeki tam ünvanlarla, bu dosyadaki
// (POZISYONLIST) kısaltmaların eşlemesi. Bilinmeyen bir kısaltma gelirse ham metin
// aynen ünvan olarak saklanır, kategori boş kalır (import durmaz).
const UNVAN_KISALTMA: Record<string, string> = {
  "MAĞAZA MD.": "Mağaza Müdürü",
  "MĞZ.MD.YRD.": "Müdür Yardımcısı",
  "MD.YRD.": "Müdür Yardımcısı",
  "SATIŞ ŞEFİ": "Satış Şefi",
  "SATIŞ DANIŞMANI": "Satış Danışmanı",
  "TERZİ": "Terzi",
  "KASİYER": "Kasiyer",
  "DEPO GÖREVLİSİ": "Depo Görevlisi",
  "SERVİS SORUMLUSU": "Servis Sorumlusu",
  "HAVALİMANI MAĞAZA MD.": "Havalimanı Mağaza Müdürü",
  "DEPO SORUMLUSU": "Depo Sorumlusu",
  "TERZİ SATIŞ DANIŞMANI": "Terzi Satış Danışmanı",
  "MAĞAZA GÖRSEL DİZAYN SORUMLUSU": "Mağaza Görsel Dizayn Sorumlusu",
  "BEKÇİ": "Bekçi",
  "DÖNEMSEL SATIŞ DANIŞMANI": "Dönemsel Satış Danışmanı",
  "DÖNEMSEL KASİYER": "Dönemsel Kasiyer",
  "DÖNEMSEL DEPO GÖREVLİSİ": "Dönemsel Depo Görevlisi",
  "DÖNEMSEL PART-TIME SATIŞ DANIŞMANI": "Dönemsel Part-Time Satış Danışmanı",
  "PART TIME SATIŞ DANIŞMANI": "Part Time Satış Danışmanı",
  "ENGELLİ PERSONEL": "Engelli Personel",
  "BÖLGE MD.": "Bölge Müdürü",
  "BÖLGE MD.YRD.": "Bölge Müdürü Yardımcısı",
  "KAMYON ŞOFÖRÜ": "Kamyon Şoförü",
  "LOJİSTİK GÖREVLİSİ": "Lojistik Görevlisi",
  "BANKA HESAP İŞLERİ UZMANI": "Banka Hesap İşleri Uzmanı",
};

const HARIC_MAGAZA_KODLARI = new Set(["A400", "A401", "A402", "A405", "C400"]);

const AY_KISA_MAP: Record<string, number> = {
  "oca": 1, "şub": 2, "sub": 2, "mar": 3, "nis": 4, "may": 5, "haz": 6,
  "tem": 7, "ağu": 8, "agu": 8, "eyl": 9, "eki": 10, "kas": 11, "ara": 12,
};

function ayCoz(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v >= 1 && v <= 12 ? v : null;
  const s = String(v).trim().toLocaleLowerCase("tr-TR");
  if (AY_KISA_MAP[s]) return AY_KISA_MAP[s];
  const n = Number(s);
  return !Number.isNaN(n) && n >= 1 && n <= 12 ? n : null;
}

function sayi(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else {
    const s = String(v).trim();
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
      n = Number(s.replace(/\./g, "").replace(",", "."));
    } else {
      n = Number(s.replace(",", "."));
    }
  }
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function magazaKoduAyikla(sube: string): { kod: string; ad: string } {
  const s = String(sube ?? "").trim();
  const m = s.match(/^(\S+)\s*(.*)$/);
  return { kod: m ? m[1] : "", ad: m ? m[2].trim() : s };
}

function sicilNormalize(kod: string): string {
  return String(kod ?? "").trim().replace(/\.0$/, "").replace(/-\d+$/, "");
}

function turkceBuyut(s: string): string {
  return s.toLocaleUpperCase("tr-TR").trim();
}

function parcala<T>(dizi: T[], boyut: number): T[][] {
  const parcalar: T[][] = [];
  for (let i = 0; i < dizi.length; i += boyut) parcalar.push(dizi.slice(i, i + boyut));
  return parcalar;
}

function unvanCoz(pozisyonHam: string, unvanMap: Record<string, string>): { tamUnvan: string; kategori: string | null } {
  const buyuk = turkceBuyut(pozisyonHam);
  const kisaltmaEslesme = UNVAN_KISALTMA[buyuk];
  const tamUnvan = kisaltmaEslesme ?? pozisyonHam.trim();
  const kategori = unvanMap[turkceBuyut(tamUnvan)] ?? null;
  return { tamUnvan, kategori };
}

export async function iceAktarMagazaPerformans(rows: any[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, ad_soyad, rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  const { data: magazalarHam } = await supabase.from("magazalar").select("id, magaza_kodu, bolge_id");
  const magazaMap: Record<string, { id: string; bolge_id: string | null }> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaMap[m.magaza_kodu] = { id: m.id, bolge_id: m.bolge_id }; });

  const { data: bolgelerHam } = await supabase.from("bolgeler").select("id, ad");
  const bolgeMap: Record<string, string> = {};
  (bolgelerHam ?? []).forEach((b: any) => { bolgeMap[b.ad] = b.id; });

  const { data: unvanlarHam } = await supabase.from("unvan_kadro_kategorisi").select("unvan, kategori");
  const unvanMap: Record<string, string> = {};
  (unvanlarHam ?? []).forEach((u: any) => { unvanMap[turkceBuyut(u.unvan)] = u.kategori; });

  const { data: personelHam } = await supabase.from("personel").select("id, personel_kodu");
  const personelMap: Record<string, string> = {};
  (personelHam ?? []).forEach((p: any) => { if (p.personel_kodu) personelMap[sicilNormalize(p.personel_kodu)] = p.id; });

  const hatalar: SatirHata[] = [];
  let sonMagazaKodu: string | null = null;

  const magazaAylikSatirlari: Record<string, any>[] = [];
  type KisiSatirHam = { sicil: string; yil: number; ay: number; hedef_ciro: number | null; gerceklesen_ciro: number | null; hedef_adet: number | null; gerceklesen_adet: number | null; hgo: number | null; adet_hgo: number | null };
  const kisiSatirlarHam: KisiSatirHam[] = [];
  const eksikPersonel = new Map<string, { ad: string; unvan: string; kategori: string | null; magazaId: string }>();
  const magazaGuncellemeleri = new Map<string, { id: string; subetipi?: string | null; net_m2?: number | null; il_adi?: string | null; depo_m2?: number | null }>();

  // -----------------------------------------------------------------
  // 1) VALİDASYON + Total satırı için mağaza kodu takibi (sıralı işleniyor).
  // -----------------------------------------------------------------
  for (let i = 0; i < rows.length; i++) {
    const satirNo = i + 2;
    const r = rows[i];

    const yil = sayi(r["YIL"]);
    const ay = ayCoz(r["AY"]);
    const subeHam = String(r["Şube Listesi"] ?? "").trim();

    // Dosyanın altındaki "Selection Status:", "BOYUT: ..." gibi altbilgi satırları —
    // hata olarak raporlamaya gerek yok, sessizce atlanır.
    if (!yil || !ay || !subeHam) continue;

    const isTotal = turkceBuyut(subeHam) === "TOTAL";
    let magazaKodu: string;
    let magazaAdi = "";
    if (isTotal) {
      if (!sonMagazaKodu) { hatalar.push({ satir: satirNo, hata: "Total satırından önce mağaza satırı bulunamadı." }); continue; }
      magazaKodu = sonMagazaKodu;
    } else {
      const ayiklanan = magazaKoduAyikla(subeHam);
      if (!ayiklanan.kod) { hatalar.push({ satir: satirNo, hata: "Şube Listesi alanı okunamadı." }); continue; }
      magazaKodu = ayiklanan.kod;
      magazaAdi = ayiklanan.ad;
      sonMagazaKodu = magazaKodu;
    }

    let magaza = magazaMap[magazaKodu];
    const bolgeAdi = String(r["Bölge Listesi"] ?? "").trim();
    const ilAdi = String(r["IL ADI"] ?? "").trim() || null;
    const segment = String(r["MAGAZA SEGMENT"] ?? "").trim() || null;
    const netM2 = sayi(r["NETM2"]);
    const depoM2 = sayi(r["DEPOM2"]);

    if (!magaza && !isTotal) {
      if (!bolgeAdi) {
        hatalar.push({ satir: satirNo, hata: `Mağaza (${magazaKodu}) sistemde yok ve Bölge Listesi boş olduğu için oluşturulamadı.` });
        continue;
      }
      let bolgeId = bolgeMap[bolgeAdi];
      if (!bolgeId) {
        const { data: yeniBolge, error: bolgeHata } = await supabase.from("bolgeler").insert({ ad: bolgeAdi }).select("id").single();
        if (bolgeHata || !yeniBolge) { hatalar.push({ satir: satirNo, hata: `Bölge (${bolgeAdi}) oluşturulamadı: ` + bolgeHata?.message }); continue; }
        bolgeId = yeniBolge.id;
        bolgeMap[bolgeAdi] = bolgeId;
      }
      const { data: yeniMagaza, error: magazaHata } = await supabase
        .from("magazalar")
        .insert({ magaza_kodu: magazaKodu, magaza_adi: magazaAdi || magazaKodu, bolge_id: bolgeId, subetipi: segment, net_m2: netM2, depo_m2: depoM2, il_adi: ilAdi, aktif: true })
        .select("id, bolge_id")
        .single();
      if (magazaHata || !yeniMagaza) { hatalar.push({ satir: satirNo, hata: `Mağaza (${magazaKodu}) oluşturulamadı: ` + magazaHata?.message }); continue; }
      magaza = { id: yeniMagaza.id, bolge_id: yeniMagaza.bolge_id };
      magazaMap[magazaKodu] = magaza;
    } else if (magaza && !isTotal) {
      const guncelleme: any = { id: magaza.id };
      if (segment !== null) guncelleme.subetipi = segment;
      if (netM2 !== null) guncelleme.net_m2 = netM2;
      if (ilAdi !== null) guncelleme.il_adi = ilAdi;
      if (depoM2 !== null) guncelleme.depo_m2 = depoM2;
      magazaGuncellemeleri.set(magaza.id, guncelleme);
    }

    if (!magaza) { hatalar.push({ satir: satirNo, hata: `Mağaza (${magazaKodu}) bulunamadı.` }); continue; }
    if (HARIC_MAGAZA_KODLARI.has(magazaKodu)) continue;

    const netSatis = sayi(r["NET SATIS KDV DAHIL"]);
    const netMiktar = sayi(r["NET MIKTAR"]);

    if (isTotal) {
      const ciroHedef = sayi(r["MAGAZA CIRO HEDEF"]);
      const adetHedef = sayi(r["MAGAZA ADET HEDEF"]);
      const hgoCiro = netSatis !== null && ciroHedef ? Math.round((netSatis / ciroHedef) * 10000) / 100 : null;
      const hgoAdet = netMiktar !== null && adetHedef ? Math.round((netMiktar / adetHedef) * 10000) / 100 : null;

      magazaAylikSatirlari.push({
        magaza_id: magaza.id, yil, ay,
        hgo: hgoCiro, adet_hgo: hgoAdet,
        sepet_ortalamasi: sayi(r["SEPET ORTALAMASI"]), sepet_derinligi: sayi(r["SEPET DERINLIGI"]),
        donusum_orani: sayi(r["DONUSUMORANI"]), giren_musteri_sayisi: sayi(r["GIRENMUSTERISAYISI"]),
        toplam_ciro_kdv_dahil: netSatis, satis_adeti: netMiktar,
        omnichannel_ciro: sayi(r["OMNCHNL NET SATIS KDV DAHIL"]), omnichannel_haric_ciro: sayi(r["OMNCHNL HARIC NET SATIS KDV DAHIL"]),
        magaza_ciro_hedef: ciroHedef, magaza_adet_hedef: adetHedef,
      });
      continue;
    }

    const sicilHam = r["PLASIYERKODU"];
    if (sicilHam === null || sicilHam === undefined || sicilHam === "") continue;
    const sicil = sicilNormalize(String(sicilHam));
    const plasiyerAdi = String(r["PLASIYERADI"] ?? "").trim();
    const pozisyonHam = String(r["POZISYONLIST"] ?? "").trim();
    const { tamUnvan, kategori } = unvanCoz(pozisyonHam, unvanMap);

    if (!personelMap[sicil] && !eksikPersonel.has(sicil)) {
      eksikPersonel.set(sicil, { ad: plasiyerAdi || sicil, unvan: tamUnvan, kategori, magazaId: magaza.id });
    }

    const plasiyerCiroHedef = sayi(r["PLASIYER CIRO HEDEF"]);
    const plasiyerAdetHedef = sayi(r["PLASIYER ADET HEDEF"]);
    const hgoCiro = netSatis !== null && plasiyerCiroHedef ? Math.round((netSatis / plasiyerCiroHedef) * 10000) / 100 : null;
    const hgoAdet = netMiktar !== null && plasiyerAdetHedef ? Math.round((netMiktar / plasiyerAdetHedef) * 10000) / 100 : null;

    kisiSatirlarHam.push({
      sicil, yil, ay,
      hedef_ciro: plasiyerCiroHedef, gerceklesen_ciro: netSatis,
      hedef_adet: plasiyerAdetHedef, gerceklesen_adet: netMiktar,
      hgo: hgoCiro, adet_hgo: hgoAdet,
    });
  }

  // -----------------------------------------------------------------
  // 2) Mağaza güncellemeleri (SUBETIPI/NETM2/İL/DEPOM2) — tek RPC round-trip.
  // -----------------------------------------------------------------
  if (magazaGuncellemeleri.size > 0) {
    const { error } = await supabase.rpc("magazalar_toplu_guncelle_v2", { p_guncellemeler: Array.from(magazaGuncellemeleri.values()) });
    if (error) hatalar.push({ satir: 0, hata: "Mağaza bilgileri toplu güncellenemedi: " + error.message });
  }

  // -----------------------------------------------------------------
  // 3) Eksik personeli otomatik oluştur (placeholder birleştirme + yeni ekleme).
  // -----------------------------------------------------------------
  if (eksikPersonel.size > 0) {
    const { data: placeholderlarHam } = await supabase.from("personel").select("id, personel_kodu").like("tc_kimlik_no", "PLASIYER-%");
    const placeholderMap: Record<string, string> = {};
    (placeholderlarHam ?? []).forEach((p: any) => { if (p.personel_kodu) placeholderMap[p.personel_kodu] = p.id; });

    const birlestirilecekler: { id: string; sicil: string }[] = [];
    const yeniEklenecekler: { sicil: string; bilgi: { ad: string; unvan: string; kategori: string | null; magazaId: string } }[] = [];
    eksikPersonel.forEach((bilgi, sicil) => {
      if (placeholderMap[sicil]) birlestirilecekler.push({ id: placeholderMap[sicil], sicil });
      else yeniEklenecekler.push({ sicil, bilgi });
    });

    for (const parca of parcala(birlestirilecekler, 300)) {
      const guncellemeler = parca.map((p) => {
        const bilgi = eksikPersonel.get(p.sicil)!;
        return { id: p.id, ad_soyad: bilgi.ad, guncel_unvan: bilgi.unvan, kadro_kategorisi: bilgi.kategori, guncel_magaza_id: bilgi.magazaId };
      });
      const { error } = await supabase.rpc("personel_placeholder_birlestir_basit", { p_guncellemeler: guncellemeler });
      if (error) hatalar.push({ satir: 0, hata: "Yer tutucu personel birleştirilemedi: " + error.message });
      else parca.forEach((p) => { personelMap[p.sicil] = p.id; });
    }

    for (const parca of parcala(yeniEklenecekler, 500)) {
      const { data: eklenenler, error } = await supabase
        .from("personel")
        .upsert(
          parca.map((p) => ({
            tc_kimlik_no: `PLASIYER-${p.sicil}`, personel_kodu: p.sicil, ad_soyad: p.bilgi.ad,
            guncel_unvan: p.bilgi.unvan, kadro_kategorisi: p.bilgi.kategori, guncel_magaza_id: p.bilgi.magazaId, durum: "aktif",
          })),
          { onConflict: "tc_kimlik_no" }
        )
        .select("id, personel_kodu");
      if (error) hatalar.push({ satir: 0, hata: "Yeni personel oluşturulamadı: " + error.message });
      else (eklenenler ?? []).forEach((p: any) => { if (p.personel_kodu) personelMap[p.personel_kodu] = p.id; });
    }
  }

  // -----------------------------------------------------------------
  // 4) Kişi aylık satırlarını (artık personelMap tam) oluştur.
  // -----------------------------------------------------------------
  const kisiAylikSatirlari: any[] = [];
  for (const satir of kisiSatirlarHam) {
    const personelId = personelMap[satir.sicil];
    if (!personelId) { hatalar.push({ satir: 0, hata: `Sicil (${satir.sicil}) için personel bulunamadı/oluşturulamadı, atlandı.` }); continue; }
    kisiAylikSatirlari.push({
      personel_id: personelId, yil: satir.yil, ay: satir.ay,
      hedef_ciro_kdv_dahil: satir.hedef_ciro, gerceklesen_ciro_kdv_dahil: satir.gerceklesen_ciro,
      hedef_adet: satir.hedef_adet, gerceklesen_adet: satir.gerceklesen_adet,
      hgo: satir.hgo, adet_hgo: satir.adet_hgo,
    });
  }

  // -----------------------------------------------------------------
  // 5) TOPLU UPSERT.
  // -----------------------------------------------------------------
  let basarili = 0;
  const PARCA_BOYUTU = 500;

  for (const parca of parcala(magazaAylikSatirlari, PARCA_BOYUTU)) {
    const { error } = await supabase.from("performans_magaza_aylik").upsert(parca, { onConflict: "magaza_id,yil,ay" });
    if (error) hatalar.push({ satir: 0, hata: "Mağaza aylık veri kaydında hata: " + error.message });
    else basarili += parca.length;
  }

  for (const parca of parcala(kisiAylikSatirlari, PARCA_BOYUTU)) {
    const { error } = await supabase.from("performans_kisi_aylik").upsert(parca, { onConflict: "personel_id,yil,ay" });
    if (error) hatalar.push({ satir: 0, hata: "Kişi aylık veri kaydında hata: " + error.message });
    else basarili += parca.length;
  }

  // -----------------------------------------------------------------
  // 6) Kişi ortalama HGO + kategori sayaçları.
  // -----------------------------------------------------------------
  const etkilenenPersonelIdleri = Array.from(new Set(kisiAylikSatirlari.map((s) => s.personel_id)));
  const tumAylar: { personel_id: string; hgo: number | null }[] = [];
  for (const parca of parcala(etkilenenPersonelIdleri, PARCA_BOYUTU)) {
    const { data } = await supabase.from("performans_kisi_aylik").select("personel_id, hgo").in("personel_id", parca).not("hgo", "is", null);
    if (data) tumAylar.push(...(data as any[]));
  }
  const gruplanmis = new Map<string, number[]>();
  tumAylar.forEach((a) => {
    if (a.hgo === null) return;
    if (!gruplanmis.has(a.personel_id)) gruplanmis.set(a.personel_id, []);
    gruplanmis.get(a.personel_id)!.push(a.hgo);
  });
  const personelGuncellemeleri = Array.from(gruplanmis.entries()).map(([personelId, degerler]) => {
    const ortalama = degerler.reduce((s, v) => s + v, 0) / degerler.length;
    return {
      id: personelId, performans_ortalama_hgo: ortalama,
      performans_80_alti_sayisi: degerler.filter((v) => v < 80).length,
      performans_80_100_arasi_sayisi: degerler.filter((v) => v >= 80 && v <= 100).length,
      performans_100_ustu_sayisi: degerler.filter((v) => v > 100).length,
    };
  });
  for (const parca of parcala(personelGuncellemeleri, PARCA_BOYUTU)) {
    const { error } = await supabase.from("personel").upsert(parca, { onConflict: "id" });
    if (error) hatalar.push({ satir: 0, hata: "Personel performans özeti güncellenemedi: " + error.message });
  }

  await supabase.from("import_gecmisi").insert({ tip: "magaza_performans", kullanici_id: me.id, kullanici_adi: me.ad_soyad, basarili, hatali: hatalar.length });

  revalidatePath("/personel");
  revalidatePath("/norm");
  revalidatePath("/raporlar");
  revalidatePath("/dashboard");
  return { basarili, hatalar };
}
