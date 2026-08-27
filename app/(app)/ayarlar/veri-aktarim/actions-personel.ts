"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

function excelTarih(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    // Excel seri tarih -> JS Date (1900 sistemi, epoch farkı 25569 gün)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // dd.mm.yyyy veya dd/mm/yyyy formatlarını da destekle
  const m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// Gerçek dosyada başlıklar "Personel\nKodu" gibi kelimeler arası satır sonu (\n) içeriyor,
// boşluk değil. Bu yüzden anahtarları normalize edip (her tür boşluk -> tek boşluk) öyle okuyoruz.
function baslikNormallestir(s: string): string {
  return s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}
function satirNormallestir(r: Record<string, any>): Record<string, any> {
  const yeni: Record<string, any> = {};
  for (const k of Object.keys(r)) {
    yeni[baslikNormallestir(k)] = r[k];
  }
  return yeni;
}

function turkceBuyut(s: string): string {
  return s.toLocaleUpperCase("tr-TR").trim();
}

export async function iceAktarPersonel(rowsHam: any[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  // Ünvan -> kategori eşlemesini bir kere çekip cache'liyoruz. Gerçek dosyada ünvanlar
  // BÜYÜK HARFLE geliyor ("SATIŞ DANIŞMANI") — bu yüzden Türkçe büyük harfe çevrilmiş anahtarla eşleştiriyoruz.
  const { data: unvanlarHam } = await supabase.from("unvan_kadro_kategorisi").select("unvan, kategori");
  const unvanMap: Record<string, string> = {};
  (unvanlarHam ?? []).forEach((u: any) => { unvanMap[turkceBuyut(u.unvan)] = u.kategori; });

  // Mağaza Kodu -> mağaza id eşlemesini de bir kere çekiyoruz
  const { data: magazalarHam } = await supabase.from("magazalar").select("id, magaza_kodu");
  const magazaMap: Record<string, string> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaMap[m.magaza_kodu] = m.id; });

  let basarili = 0;
  const hatalar: SatirHata[] = [];

  for (let i = 0; i < rowsHam.length; i++) {
    const satirNo = i + 2;
    const r = satirNormallestir(rowsHam[i]);

    // Gerçek dosyada "İşten Ayrılma Tarihi" hiç boş gelmiyor — hâlâ çalışanlar için 1900-01-01
    // placeholder tarih kullanılıyor. Sadece bunun DIŞINDA bir tarih varsa gerçekten ayrılmış sayılır.
    const ayrilmaTarihiParsed = excelTarih(r["İşten Ayrılma Tarihi"]);
    const gercektenAyrilmisMi = ayrilmaTarihiParsed !== null && ayrilmaTarihiParsed !== "1900-01-01";
    if (gercektenAyrilmisMi) {
      continue;
    }

    const tcKimlikNo = String(r["TC Kimlik No"] ?? "").trim();
    const personelKodu = String(r["Personel Kodu"] ?? "").trim();
    const adSoyad = String(r["Adı-Soyadı"] ?? "").trim();
    const departmanKodu = String(r["Departman Kodu"] ?? "").trim();
    const unvanHam = String(r["İş Ünvanı Açıklaması"] ?? "").trim();
    const dogumTarihi = excelTarih(r["Doğum Tarihi"]);
    const cinsiyet = String(r["Cinsiyet Açıklaması"] ?? "").trim() || null;
    const iseBaslamaTarihi = excelTarih(r["İşyeri Başlama Tarihi"]);

    if (!tcKimlikNo || !adSoyad || !departmanKodu || !unvanHam) {
      hatalar.push({ satir: satirNo, hata: "TC Kimlik No, Adı-Soyadı, Departman Kodu veya İş Ünvanı Açıklaması eksik." });
      continue;
    }

    const magazaId = magazaMap[departmanKodu];
    if (!magazaId) {
      hatalar.push({ satir: satirNo, hata: `Departman Kodu (${departmanKodu}) sistemde tanımlı bir mağaza koduna karşılık gelmiyor — önce Mağaza Bilgisi import edilmeli.` });
      continue;
    }

    const kategori = unvanMap[turkceBuyut(unvanHam)];
    if (!kategori) {
      hatalar.push({ satir: satirNo, hata: `İş Ünvanı Açıklaması (${unvanHam}) tanınan ünvan listesinde yok.` });
      continue;
    }

    const { data: personel, error: personelHata } = await supabase
      .from("personel")
      .upsert(
        {
          tc_kimlik_no: tcKimlikNo,
          personel_kodu: personelKodu || null,
          ad_soyad: adSoyad,
          dogum_tarihi: dogumTarihi,
          cinsiyet: cinsiyet,
          guncel_magaza_id: magazaId,
          guncel_unvan: unvanHam,
          durum: "aktif",
          kadro_kategorisi: kategori,
          kidem_baslangic_tarihi: iseBaslamaTarihi,
        },
        { onConflict: "tc_kimlik_no" }
      )
      .select("id")
      .single();

    if (personelHata || !personel) {
      hatalar.push({ satir: satirNo, hata: "Personel kaydedilemedi: " + personelHata?.message });
      continue;
    }

    // Atama geçmişi: aynı personel+mağaza+başlama tarihi ile daha önce kayıt açılmışsa tekrar eklenmez (re-import güvenliği)
    if (iseBaslamaTarihi) {
      const { data: mevcutAtama } = await supabase
        .from("personel_atama_gecmisi")
        .select("id")
        .eq("personel_id", personel.id)
        .eq("magaza_id", magazaId)
        .eq("baslama_tarihi", iseBaslamaTarihi)
        .maybeSingle();

      if (!mevcutAtama) {
        await supabase.from("personel_atama_gecmisi").insert({
          personel_id: personel.id,
          magaza_id: magazaId,
          unvan: unvanHam,
          baslama_tarihi: iseBaslamaTarihi,
          kaynak: "import",
        });
      }
    }

    basarili++;
  }

  revalidatePath("/personel");
  revalidatePath("/norm");
  revalidatePath("/dashboard");
  return { basarili, hatalar };
}
