"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

// Tasarım notu 5.3 madde 4: bu mağazalar online satış kanalları, kişi performansına hiç katılmaz.
// Tasarım notu 5.2'de AY sütununun sayı olduğu varsayılmıştı, ama gerçek dosyada
// "Oca", "Tem" gibi Türkçe kısaltmalar var — Mağaza Bilgisi importundaki aynı haritayı kullanıyoruz.
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

const HARIC_MAGAZA_KODLARI = new Set(["A400", "A401", "A402", "A405", "C400"]);

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

function magazaKoduAyikla(sube: string): string {
  const m = String(sube ?? "").trim().match(/^(\S+)/);
  return m ? m[1] : "";
}

function sicilNormalize(kod: string): string {
  return String(kod ?? "").trim().replace(/-\d+$/, "");
}

function parcala<T>(dizi: T[], boyut: number): T[][] {
  const parcalar: T[][] = [];
  for (let i = 0; i < dizi.length; i += boyut) parcalar.push(dizi.slice(i, i + boyut));
  return parcalar;
}

export async function iceAktarPerformans(rows: any[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, ad_soyad, rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  const { data: magazalarHam } = await supabase.from("magazalar").select("id, magaza_kodu");
  const magazaMap: Record<string, string> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaMap[m.magaza_kodu] = m.id; });

  const { data: personelHam } = await supabase.from("personel").select("id, personel_kodu");
  const personelMap: Record<string, string> = {};
  (personelHam ?? []).forEach((p: any) => { if (p.personel_kodu) personelMap[sicilNormalize(p.personel_kodu)] = p.id; });

  const { data: unvanlarHam } = await supabase.from("unvan_kadro_kategorisi").select("unvan, kategori");
  const unvanMap: Record<string, string> = {};
  (unvanlarHam ?? []).forEach((u: any) => { unvanMap[u.unvan.toLocaleUpperCase("tr-TR")] = u.kategori; });

  const hatalar: SatirHata[] = [];
  const magazaAylikSatirlari: {
    magaza_id: string; yil: number; ay: number; hgo: number;
    adet_hgo: number | null; satis_adeti: number | null; toplam_ciro_kdv_dahil: number | null;
    omnichannel_ciro: number | null; omnichannel_haric_ciro: number | null;
  }[] = [];
  const etkilenenPersonelIdleri = new Set<string>();

  // Personel tabloda hiç yoksa (Personel importundan bağımsız olarak) Performans dosyasındaki
  // bilgilerle otomatik oluşturuluyor — TC eşleştirmesi veya başka bir ön koşul aranmıyor.
  type KisiSatirHam = { sicil: string; yil: number; ay: number; hedefCiro: number; gerceklesenCiro: number };
  const kisiSatirlarHam: KisiSatirHam[] = [];
  const eksikPersonel = new Map<string, { ad: string; unvan: string; magazaId: string }>();

  // -----------------------------------------------------------------
  // 1) VALİDASYON — hiç DB yazma çağrısı yapmadan tüm satırları işleyip diziye topla.
  // -----------------------------------------------------------------
  for (let i = 0; i < rows.length; i++) {
    const satirNo = i + 2;
    const r = rows[i];

    const yil = sayi(r["YIL"]);
    const ay = ayCoz(r["AY"]);
    const subeHam = String(r["Şubeler"] ?? "").trim();
    const magazaKodu = magazaKoduAyikla(subeHam);

    if (!yil || !ay || !magazaKodu) {
      hatalar.push({ satir: satirNo, hata: "YIL, AY veya Şubeler alanı eksik/okunamadı." });
      continue;
    }
    if (ay < 1 || ay > 12) {
      hatalar.push({ satir: satirNo, hata: `Geçersiz ay değeri: ${ay}` });
      continue;
    }

    const magazaId = magazaMap[magazaKodu];
    if (!magazaId) {
      hatalar.push({ satir: satirNo, hata: `Şubeler alanındaki mağaza kodu (${magazaKodu}) sistemde tanımlı değil.` });
      continue;
    }
    if (HARIC_MAGAZA_KODLARI.has(magazaKodu)) continue;

    const plasiyerAdi = String(r["Plasiyer Adı"] ?? "").trim();
    const plasiyerKoduHam = String(r["Plasiyer Kodu"] ?? "").trim();
    const isTotal = plasiyerAdi.toLocaleUpperCase("tr-TR") === "TOTAL" || plasiyerKoduHam.toLocaleUpperCase("tr-TR") === "TOTAL";

    if (isTotal) {
      const hazirHgo = sayi(r["Ciro Hedef Gerçekleştirme Oranı"]);
      if (hazirHgo === null) {
        hatalar.push({ satir: satirNo, hata: "Total satırında Ciro Hedef Gerçekleştirme Oranı okunamadı." });
        continue;
      }
      const adetHgo = sayi(r["Adet Hedef Gerçekleştirme Oranı"]);
      const satisAdeti = sayi(r["Satış Miktarı(Toplam Adet)"]);
      const toplamCiro = sayi(r["Toplam Ciro KDV Dahil"]);
      const omnichannelCiro = sayi(r["OMS KDV Dahil Ciro"]);
      const omnichannelHaricCiro = sayi(r["Satış Tutarı KDV Dahil(OMS Hariç)"]);

      magazaAylikSatirlari.push({
        magaza_id: magazaId, yil, ay, hgo: hazirHgo,
        adet_hgo: adetHgo, satis_adeti: satisAdeti, toplam_ciro_kdv_dahil: toplamCiro,
        omnichannel_ciro: omnichannelCiro, omnichannel_haric_ciro: omnichannelHaricCiro,
      });
      continue;
    }

    if (!plasiyerKoduHam) {
      hatalar.push({ satir: satirNo, hata: "Plasiyer Kodu eksik." });
      continue;
    }

    const hedefCiro = sayi(r["Plasiyer Hedef Ciro (Kdv Dahil)"]);
    const gerceklesenCiro = sayi(r["Toplam Ciro KDV Dahil"]);
    if (hedefCiro === null || gerceklesenCiro === null) {
      hatalar.push({ satir: satirNo, hata: "Hedef Ciro (KDV Dahil) veya Toplam Ciro (KDV Dahil) okunamadı." });
      continue;
    }

    const sicil = sicilNormalize(plasiyerKoduHam);
    if (!personelMap[sicil] && !eksikPersonel.has(sicil)) {
      const unvan = String(r["Title"] ?? "").trim();
      eksikPersonel.set(sicil, { ad: plasiyerAdi || sicil, unvan, magazaId });
    }

    kisiSatirlarHam.push({ sicil, yil, ay, hedefCiro, gerceklesenCiro });
  }

  // -----------------------------------------------------------------
  // 1.5) Eksik personeli, Performans dosyasındaki bilgilerle otomatik oluştur
  //      (Personel importuna veya TC eşleştirmesine bağlı değil).
  // -----------------------------------------------------------------
  if (eksikPersonel.size > 0) {
    const yeniPersonelSatirlari = Array.from(eksikPersonel.entries()).map(([sicil, bilgi]) => {
      const kategori = bilgi.unvan ? unvanMap[bilgi.unvan.toLocaleUpperCase("tr-TR")] ?? null : null;
      return {
        tc_kimlik_no: `PLASIYER-${sicil}`,
        personel_kodu: sicil,
        ad_soyad: bilgi.ad,
        guncel_unvan: bilgi.unvan || null,
        guncel_magaza_id: bilgi.magazaId,
        durum: "aktif",
        kadro_kategorisi: kategori,
      };
    });

    for (const parca of parcala(yeniPersonelSatirlari, 500)) {
      const { data: eklenenler, error } = await supabase
        .from("personel")
        .upsert(parca, { onConflict: "tc_kimlik_no" })
        .select("id, personel_kodu");
      if (error) {
        hatalar.push({ satir: 0, hata: "Eksik personel otomatik oluşturulamadı: " + error.message });
      } else {
        (eklenenler ?? []).forEach((p: any) => { if (p.personel_kodu) personelMap[p.personel_kodu] = p.id; });
      }
    }
  }

  // -----------------------------------------------------------------
  // 2) Kişi aylık satırlarını (artık tüm personelMap eşleşmeleri hazır) oluştur.
  // -----------------------------------------------------------------
  const kisiAylikSatirlari: { personel_id: string; yil: number; ay: number; hedef_ciro_kdv_dahil: number; gerceklesen_ciro_kdv_dahil: number; hgo: number | null }[] = [];
  for (const satir of kisiSatirlarHam) {
    const personelId = personelMap[satir.sicil];
    if (!personelId) {
      hatalar.push({ satir: 0, hata: `Sicil (${satir.sicil}) için personel oluşturulamadı, atlandı.` });
      continue;
    }
    const kisiHgo = satir.hedefCiro > 0 ? (satir.gerceklesenCiro / satir.hedefCiro) * 100 : null;
    kisiAylikSatirlari.push({
      personel_id: personelId, yil: satir.yil, ay: satir.ay,
      hedef_ciro_kdv_dahil: satir.hedefCiro, gerceklesen_ciro_kdv_dahil: satir.gerceklesenCiro, hgo: kisiHgo,
    });
    etkilenenPersonelIdleri.add(personelId);
  }

  // -----------------------------------------------------------------
  // 3) TOPLU UPSERT — 500'lük parçalar hâlinde (604 satır için tek tek değil ~2-3 istek)
  // -----------------------------------------------------------------
  const PARCA_BOYUTU = 500;
  let basarili = 0;

  for (const parca of parcala(magazaAylikSatirlari, PARCA_BOYUTU)) {
    const { error } = await supabase.from("performans_magaza_aylik").upsert(parca, { onConflict: "magaza_id,yil,ay" });
    if (error) hatalar.push({ satir: 0, hata: "Mağaza aylık HGO toplu kaydında hata: " + error.message });
    else basarili += parca.length;
  }

  for (const parca of parcala(kisiAylikSatirlari, PARCA_BOYUTU)) {
    const { error } = await supabase.from("performans_kisi_aylik").upsert(parca, { onConflict: "personel_id,yil,ay" });
    if (error) hatalar.push({ satir: 0, hata: "Kişi aylık performans toplu kaydında hata: " + error.message });
    else basarili += parca.length;
  }

  // -----------------------------------------------------------------
  // 4) ORTALAMA HGO + KATEGORİ SAYAÇLARI — her personel için ayrı ayrı select+update yerine
  //    TEK sorguda tüm etkilenen personelin tüm aylık verisini çekip JS'te gruplayıp
  //    TEK toplu upsert ile personel tablosuna yazıyoruz.
  // -----------------------------------------------------------------
  const personelIdListesi = Array.from(etkilenenPersonelIdleri);
  const tumAylar: { personel_id: string; hgo: number | null }[] = [];

  for (const parca of parcala(personelIdListesi, PARCA_BOYUTU)) {
    const { data } = await supabase
      .from("performans_kisi_aylik")
      .select("personel_id, hgo")
      .in("personel_id", parca)
      .not("hgo", "is", null);
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
      id: personelId,
      performans_ortalama_hgo: ortalama,
      performans_80_alti_sayisi: degerler.filter((v) => v < 80).length,
      performans_80_100_arasi_sayisi: degerler.filter((v) => v >= 80 && v <= 100).length,
      performans_100_ustu_sayisi: degerler.filter((v) => v > 100).length,
    };
  });

  for (const parca of parcala(personelGuncellemeleri, PARCA_BOYUTU)) {
    const { error } = await supabase.from("personel").upsert(parca, { onConflict: "id" });
    if (error) hatalar.push({ satir: 0, hata: "Personel performans özeti güncellenemedi: " + error.message });
  }

  revalidatePath("/personel");
  revalidatePath("/raporlar");
  revalidatePath("/dashboard");
  return { basarili, hatalar };
}
