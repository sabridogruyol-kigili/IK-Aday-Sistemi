"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string; eslenemeyenSutunlar?: string[] };

// Türkçe ay adları -> ay numarası. Türkçe karakter içeren ve içermeyen (Subat, Mayis, Agustos, Eylul, Kasim) varyantlar dahil.
const AY_MAP: Record<string, number> = {
  ocak: 1, oca: 1,
  subat: 2, şubat: 2, sub: 2, şub: 2,
  mart: 3, mar: 3,
  nisan: 4, nis: 4,
  mayis: 5, mayıs: 5, may: 5,
  haziran: 6, haz: 6,
  temmuz: 7, tem: 7,
  agustos: 8, ağustos: 8, agu: 8, ağu: 8,
  eylul: 9, eylül: 9, eyl: 9,
  ekim: 10, eki: 10,
  kasim: 11, kasım: 11, kas: 11,
  aralik: 12, aralık: 12, ara: 12,
};

const METRIK_ANAHTAR: { pattern: RegExp; alan: "sepet_ortalamasi" | "sepet_derinligi" | "donusum_orani" | "giren_musteri_sayisi" }[] = [
  { pattern: /sepet.*ortalama/i, alan: "sepet_ortalamasi" },
  { pattern: /sepet.*derinl/i, alan: "sepet_derinligi" },
  { pattern: /d[oö]n[uü]ş[uü]m/i, alan: "donusum_orani" },
  { pattern: /giren.*m[uü]şteri/i, alan: "giren_musteri_sayisi" },
];

function turkceKucult(s: string): string {
  return s
    .replace(/İ/g, "i").replace(/I/g, "ı")
    .toLocaleLowerCase("tr-TR");
}

// Bir sütun başlığından (metrik alanı, yıl, ay) çözümlemeye çalışır.
// Örn: "Ocak 2025 SEPET ORTALAMASI", "SEPET ORTALAMASI-Oca25", "01.2025 Dönüşüm Oranı" gibi çeşitli formatları destekler.
function kolonCozumle(baslik: string): { alan: string; yil: number; ay: number } | null {
  // Not: JS'in /i (case-insensitive) bayrağı Türkçe büyük İ'yi küçük i'ye eşitlemiyor —
  // bu yüzden önce toLocaleLowerCase('tr-TR') ile küçültüp ONUN üzerinden eşleştiriyoruz.
  const kucukBaslik = turkceKucult(baslik);

  const metrikEslesme = METRIK_ANAHTAR.find((m) => m.pattern.test(kucukBaslik));
  if (!metrikEslesme) return null;

  // 1) Ay adı + yıl (2 veya 4 haneli) — "ocak 2025", "oca-25", "oca.25", "oca25"
  //    4 haneli yıl önce denenir, aksi halde "2025" başlığından yanlışlıkla "20" yakalanabilir.
  for (const [ayAdi, ayNo] of Object.entries(AY_MAP)) {
    const re = new RegExp(`${ayAdi}[.\\-_ ]?('?\\d{4}|'?\\d{2})`, "i");
    const m = kucukBaslik.match(re);
    if (m) {
      let yil = parseInt(m[1].replace("'", ""), 10);
      if (yil < 100) yil += 2000;
      return { alan: metrikEslesme.alan, yil, ay: ayNo };
    }
  }

  // 2) Sayısal ay.yıl veya yıl.ay formatı — "01.2025", "2025-01", "01-25"
  const numMatch = baslik.match(/(\d{1,2})[.\-_/](\d{4})|(\d{1,2})[.\-_/](\d{2})(?!\d)|(\d{4})[.\-_/](\d{1,2})/);
  if (numMatch) {
    if (numMatch[1] && numMatch[2]) {
      const ay = parseInt(numMatch[1], 10);
      const yil = parseInt(numMatch[2], 10);
      if (ay >= 1 && ay <= 12) return { alan: metrikEslesme.alan, yil, ay };
    } else if (numMatch[3] && numMatch[4]) {
      const ay = parseInt(numMatch[3], 10);
      let yil = parseInt(numMatch[4], 10);
      if (yil < 100) yil += 2000;
      if (ay >= 1 && ay <= 12) return { alan: metrikEslesme.alan, yil, ay };
    } else if (numMatch[5] && numMatch[6]) {
      const yil = parseInt(numMatch[5], 10);
      const ay = parseInt(numMatch[6], 10);
      if (ay >= 1 && ay <= 12) return { alan: metrikEslesme.alan, yil, ay };
    }
  }

  return null;
}

function magazaKoduAyikla(sube: string): { kod: string; ad: string } {
  const s = String(sube ?? "").trim();
  const m = s.match(/^(\S+)\s*(.*)$/);
  return { kod: m ? m[1] : "", ad: m ? m[2].trim() : s };
}

function sayi(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export async function iceAktarMagazaBilgisi(rows: any[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  if (rows.length === 0) return { basarili: 0, hatalar: [{ satir: 0, hata: "Dosyada satır bulunamadı." }] };

  const tumBasliklar = Object.keys(rows[0]);
  const sabitBasliklar = new Set(["Şube Listesi", "Bölge Listesi", "SUBETIPI", "NETM2"]);
  const aylikBasliklar = tumBasliklar.filter((b) => !sabitBasliklar.has(b));

  const kolonHaritasi = new Map<string, { alan: string; yil: number; ay: number }>();
  const eslenemeyenSutunlar: string[] = [];
  for (const baslik of aylikBasliklar) {
    const sonuc = kolonCozumle(baslik);
    if (sonuc) kolonHaritasi.set(baslik, sonuc);
    else eslenemeyenSutunlar.push(baslik);
  }

  if (kolonHaritasi.size === 0) {
    return {
      basarili: 0,
      hatalar: [{ satir: 0, hata: "Hiçbir aylık metrik sütunu tanınamadı. Sütun başlıklarını kontrol edin." }],
      eslenemeyenSutunlar,
    };
  }

  // Mevcut mağaza ve bölgeleri önceden çek, eksik olanları import sırasında oluştur.
  const { data: magazalarHam } = await supabase.from("magazalar").select("id, magaza_kodu, bolge_id");
  const magazaMap: Record<string, { id: string; bolge_id: string | null }> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaMap[m.magaza_kodu] = { id: m.id, bolge_id: m.bolge_id }; });

  const { data: bolgelerHam } = await supabase.from("bolgeler").select("id, ad");
  const bolgeMap: Record<string, string> = {};
  (bolgelerHam ?? []).forEach((b: any) => { bolgeMap[b.ad] = b.id; });

  let basarili = 0;
  const hatalar: SatirHata[] = [];
  // magaza_id|yil|ay -> birikimli metrik satırı
  const performansHaritasi = new Map<string, { magaza_id: string; yil: number; ay: number; [k: string]: any }>();

  for (let i = 0; i < rows.length; i++) {
    const satirNo = i + 2;
    const r = rows[i];

    const subeHam = String(r["Şube Listesi"] ?? "").trim();
    const { kod: magazaKodu, ad: magazaAdi } = magazaKoduAyikla(subeHam);
    if (!magazaKodu) {
      hatalar.push({ satir: satirNo, hata: "Şube Listesi alanı okunamadı." });
      continue;
    }

    const bolgeAdi = String(r["Bölge Listesi"] ?? "").trim();
    const subetipi = String(r["SUBETIPI"] ?? "").trim() || null;
    const netm2 = sayi(r["NETM2"]);

    let magaza = magazaMap[magazaKodu];

    if (!magaza) {
      // Mağaza sistemde yok — tasarım kararı: otomatik oluştur (Norm importundan farklı olarak burada hata verilmez).
      if (!bolgeAdi) {
        hatalar.push({ satir: satirNo, hata: `Mağaza (${magazaKodu}) sistemde yok ve Bölge Listesi boş olduğu için oluşturulamadı.` });
        continue;
      }
      let bolgeId = bolgeMap[bolgeAdi];
      if (!bolgeId) {
        const { data: yeniBolge, error: bolgeHata } = await supabase.from("bolgeler").insert({ ad: bolgeAdi }).select("id").single();
        if (bolgeHata || !yeniBolge) {
          hatalar.push({ satir: satirNo, hata: `Bölge (${bolgeAdi}) oluşturulamadı: ` + bolgeHata?.message });
          continue;
        }
        bolgeId = yeniBolge.id;
        bolgeMap[bolgeAdi] = bolgeId;
      }

      const { data: yeniMagaza, error: magazaHata } = await supabase
        .from("magazalar")
        .insert({ magaza_kodu: magazaKodu, magaza_adi: magazaAdi || magazaKodu, bolge_id: bolgeId, subetipi, net_m2: netm2, aktif: true })
        .select("id, bolge_id")
        .single();
      if (magazaHata || !yeniMagaza) {
        hatalar.push({ satir: satirNo, hata: `Mağaza (${magazaKodu}) oluşturulamadı: ` + magazaHata?.message });
        continue;
      }
      magaza = { id: yeniMagaza.id, bolge_id: yeniMagaza.bolge_id };
      magazaMap[magazaKodu] = magaza;
    } else if (subetipi !== null || netm2 !== null) {
      // Mağaza zaten varsa SUBETIPI/NETM2 güncel bilgiyle senkron tutulur (mevcut diğer alanlara dokunulmaz).
      const guncelleme: Record<string, any> = {};
      if (subetipi !== null) guncelleme.subetipi = subetipi;
      if (netm2 !== null) guncelleme.net_m2 = netm2;
      await supabase.from("magazalar").update(guncelleme).eq("id", magaza.id);
    }

    let buSatirdaEnAzBirDeger = false;
    for (const [kolon, bilgi] of kolonHaritasi) {
      const deger = sayi(r[kolon]);
      if (deger === null) continue;
      buSatirdaEnAzBirDeger = true;
      const anahtar = `${magaza.id}|${bilgi.yil}|${bilgi.ay}`;
      if (!performansHaritasi.has(anahtar)) {
        performansHaritasi.set(anahtar, { magaza_id: magaza.id, yil: bilgi.yil, ay: bilgi.ay });
      }
      performansHaritasi.get(anahtar)![bilgi.alan] = deger;
    }

    if (buSatirdaEnAzBirDeger) basarili++;
    else hatalar.push({ satir: satirNo, hata: "Bu satırda okunabilir hiçbir aylık metrik değeri bulunamadı." });
  }

  if (performansHaritasi.size > 0) {
    const satirlar = Array.from(performansHaritasi.values());
    const { error: upsertHata } = await supabase
      .from("performans_magaza_aylik")
      .upsert(satirlar, { onConflict: "magaza_id,yil,ay" });
    if (upsertHata) {
      return { basarili: 0, hatalar: [{ satir: 0, hata: "Performans verileri kaydedilemedi: " + upsertHata.message }], eslenemeyenSutunlar };
    }
  }

  revalidatePath("/norm");
  revalidatePath("/raporlar");
  revalidatePath("/dashboard");
  return { basarili, hatalar, eslenemeyenSutunlar: eslenemeyenSutunlar.length > 0 ? eslenemeyenSutunlar : undefined };
}
