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

// "A003 İstanbul Carousel" -> "A003"
function magazaKoduAyikla(sube: string): string {
  const m = String(sube ?? "").trim().match(/^(\S+)/);
  return m ? m[1] : "";
}

// "7750-1" -> "7750" (aynı kişi, sonek temizlenir — tasarım notu 5.3 madde 3)
function sicilNormalize(kod: string): string {
  return String(kod ?? "").trim().replace(/-\d+$/, "");
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

  let basarili = 0;
  const hatalar: SatirHata[] = [];
  const etkilenenPersonelIdleri = new Set<string>();

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

    if (HARIC_MAGAZA_KODLARI.has(magazaKodu)) {
      // Tasarım notu: bu mağazalar performans hesabına hiç katılmaz — satır atlanır (hata değil, kasıtlı).
      continue;
    }

    const plasiyerAdi = String(r["Plasiyer Adı"] ?? "").trim();
    const plasiyerKoduHam = String(r["Plasiyer Kodu"] ?? "").trim();
    const isTotal = plasiyerAdi.toLocaleUpperCase("tr-TR") === "TOTAL" || plasiyerKoduHam.toLocaleUpperCase("tr-TR") === "TOTAL";

    if (isTotal) {
      // Tasarım notu 5.3 madde 2: mağaza HGO, dosyadaki hazır Total satırından doğrudan alınır — sistem kendi hesaplamaz.
      const hazirHgo = sayi(r["Ciro Hedef Gerçekleştirme Oranı"]);
      if (hazirHgo === null) {
        hatalar.push({ satir: satirNo, hata: "Total satırında Ciro Hedef Gerçekleştirme Oranı okunamadı." });
        continue;
      }

      // Not: sepet_ortalamasi/sepet_derinligi/donusum_orani/giren_musteri_sayisi alanları
      // ayrı bir "Mağaza Bilgisi" importuyla doldurulur; burada sadece hgo yazılır,
      // upsert diğer mevcut kolonlara dokunmaz.
      const { error: magazaAylikHata } = await supabase
        .from("performans_magaza_aylik")
        .upsert(
          { magaza_id: magazaId, yil, ay, hgo: hazirHgo },
          { onConflict: "magaza_id,yil,ay" }
        );
      if (magazaAylikHata) {
        hatalar.push({ satir: satirNo, hata: "Mağaza aylık HGO kaydedilemedi: " + magazaAylikHata.message });
        continue;
      }

      basarili++;
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

    // Tasarım notu 5.3 madde 1: KDV Dahil sütunlar kullanılır, KDV Hariç hiç kullanılmaz.
    const hedefCiro = sayi(r["Plasiyer Hedef Ciro (Kdv Dahil)"]);
    const gerceklesenCiro = sayi(r["Toplam Ciro KDV Dahil"]);

    if (hedefCiro === null || gerceklesenCiro === null) {
      hatalar.push({ satir: satirNo, hata: "Hedef Ciro (KDV Dahil) veya Toplam Ciro (KDV Dahil) okunamadı." });
      continue;
    }

    // Tasarım notu 5.3 madde 5: kişi bazlı aylık HGO = Toplam Ciro / Hedef Ciro
    const kisiHgo = hedefCiro > 0 ? (gerceklesenCiro / hedefCiro) * 100 : null;

    const { error: kisiAylikHata } = await supabase
      .from("performans_kisi_aylik")
      .upsert(
        {
          personel_id: personelId,
          yil,
          ay,
          hedef_ciro_kdv_dahil: hedefCiro,
          gerceklesen_ciro_kdv_dahil: gerceklesenCiro,
          hgo: kisiHgo,
        },
        { onConflict: "personel_id,yil,ay" }
      );

    if (kisiAylikHata) {
      hatalar.push({ satir: satirNo, hata: "Kişi aylık performans kaydedilemedi: " + kisiAylikHata.message });
      continue;
    }

    etkilenenPersonelIdleri.add(personelId);
    basarili++;
  }

  // Tasarım notu 5.3 madde 6-7: kişi bazlı ORTALAMA HGO (basit aritmetik ortalama) ve kategori sayaçları,
  // etkilenen her personel için TÜM aylık geçmişi baz alınarak yeniden hesaplanır.
  for (const personelId of etkilenenPersonelIdleri) {
    const { data: aylar } = await supabase
      .from("performans_kisi_aylik")
      .select("hgo")
      .eq("personel_id", personelId)
      .not("hgo", "is", null);

    const degerler = (aylar ?? []).map((a: any) => a.hgo as number);
    if (degerler.length === 0) continue;

    const ortalama = degerler.reduce((s, v) => s + v, 0) / degerler.length;
    const altiSayisi = degerler.filter((v) => v < 80).length;
    const arasiSayisi = degerler.filter((v) => v >= 80 && v <= 100).length;
    const ustuSayisi = degerler.filter((v) => v > 100).length;

    await supabase
      .from("personel")
      .update({
        performans_ortalama_hgo: ortalama,
        performans_80_alti_sayisi: altiSayisi,
        performans_80_100_arasi_sayisi: arasiSayisi,
        performans_100_ustu_sayisi: ustuSayisi,
      })
      .eq("id", personelId);
  }

  revalidatePath("/personel");
  revalidatePath("/raporlar");
  revalidatePath("/dashboard");
  return { basarili, hatalar };
}
