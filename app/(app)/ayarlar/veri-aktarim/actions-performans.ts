"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

// Tasarım notu 5.3 madde 4: bu mağazalar online satış kanalları, kişi performansına hiç katılmaz.
const HARIC_MAGAZA_KODLARI = new Set(["A400", "A401", "A402", "A405", "C400"]);

function sayi(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
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

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  const { data: magazalarHam } = await supabase.from("magazalar").select("id, magaza_kodu");
  const magazaMap: Record<string, string> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaMap[m.magaza_kodu] = m.id; });

  const { data: personelHam } = await supabase.from("personel").select("id, personel_kodu");
  const personelMap: Record<string, string> = {};
  (personelHam ?? []).forEach((p: any) => { if (p.personel_kodu) personelMap[sicilNormalize(p.personel_kodu)] = p.id; });

  const hatalar: SatirHata[] = [];
  const magazaAylikSatirlari: { magaza_id: string; yil: number; ay: number; hgo: number }[] = [];
  const kisiAylikSatirlari: { personel_id: string; yil: number; ay: number; hedef_ciro_kdv_dahil: number; gerceklesen_ciro_kdv_dahil: number; hgo: number | null }[] = [];
  const etkilenenPersonelIdleri = new Set<string>();

  // -----------------------------------------------------------------
  // 1) VALİDASYON — hiç DB yazma çağrısı yapmadan tüm satırları işleyip diziye topla.
  // -----------------------------------------------------------------
  for (let i = 0; i < rows.length; i++) {
    const satirNo = i + 2;
    const r = rows[i];

    const yil = sayi(r["YIL"]);
    const ay = sayi(r["AY"]);
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
      magazaAylikSatirlari.push({ magaza_id: magazaId, yil, ay, hgo: hazirHgo });
      continue;
    }

    if (!plasiyerKoduHam) {
      hatalar.push({ satir: satirNo, hata: "Plasiyer Kodu eksik." });
      continue;
    }

    const sicil = sicilNormalize(plasiyerKoduHam);
    const personelId = personelMap[sicil];
    if (!personelId) {
      hatalar.push({ satir: satirNo, hata: `Plasiyer Kodu (${plasiyerKoduHam} -> ${sicil}) sistemde kayıtlı bir personele karşılık gelmiyor.` });
      continue;
    }

    const hedefCiro = sayi(r["Plasiyer Hedef Ciro (Kdv Dahil)"]);
    const gerceklesenCiro = sayi(r["Toplam Ciro KDV Dahil"]);
    if (hedefCiro === null || gerceklesenCiro === null) {
      hatalar.push({ satir: satirNo, hata: "Hedef Ciro (KDV Dahil) veya Toplam Ciro (KDV Dahil) okunamadı." });
      continue;
    }

    const kisiHgo = hedefCiro > 0 ? (gerceklesenCiro / hedefCiro) * 100 : null;
    kisiAylikSatirlari.push({ personel_id: personelId, yil, ay, hedef_ciro_kdv_dahil: hedefCiro, gerceklesen_ciro_kdv_dahil: gerceklesenCiro, hgo: kisiHgo });
    etkilenenPersonelIdleri.add(personelId);
  }

  // -----------------------------------------------------------------
  // 2) TOPLU UPSERT — 500'lük parçalar hâlinde (604 satır için tek tek değil ~2-3 istek)
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
  // 3) ORTALAMA HGO + KATEGORİ SAYAÇLARI — her personel için ayrı ayrı select+update yerine
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
