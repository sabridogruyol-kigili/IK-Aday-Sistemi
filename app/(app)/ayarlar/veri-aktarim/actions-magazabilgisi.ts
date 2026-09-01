"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

type MetrikGirdisi = { yil: number; ay: number; alan: string; deger: any };
type MagazaBilgisiSatiri = {
  sube_listesi: any;
  bolge_listesi: any;
  subetipi: any;
  netm2: any;
  metrikler: MetrikGirdisi[];
};

// Gerçek dosyadaki ALAN adları (satır 3 başlığı) — boşluksuz/Türkçe karaktersiz olabiliyor,
// bu yüzden ImportForm.tsx tarafında bu tam metinlerle üretiliyor, burada birebir eşleştiriyoruz.
const ALAN_ESLEME: Record<string, "sepet_ortalamasi" | "sepet_derinligi" | "donusum_orani" | "giren_musteri_sayisi"> = {
  "SEPET ORTALAMASI": "sepet_ortalamasi",
  "SEPET DERINLIGI": "sepet_derinligi",
  "DONUSUMORANI": "donusum_orani",
  "GIRENMUSTERISAYISI": "giren_musteri_sayisi",
};

function magazaKoduAyikla(sube: string): { kod: string; ad: string } {
  const s = String(sube ?? "").trim();
  const m = s.match(/^(\S+)\s*(.*)$/);
  return { kod: m ? m[1] : "", ad: m ? m[2].trim() : s };
}

function sayi(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  let n: number;
  if (typeof v === "number") {
    // Excel'den doğrudan sayısal hücre olarak gelmiş — string'e çevirip nokta silme mantığı
    // uygulanırsa (Türkçe binlik ayraç sanılıp) değer bozulur, o yüzden direkt kullanılır.
    n = v;
  } else {
    const s = String(v).trim();
    // Türkçe biçim: binlik ayraç nokta, ondalık virgül (örn. "1.234,56")
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
      n = Number(s.replace(/\./g, "").replace(",", "."));
    } else {
      n = Number(s.replace(",", "."));
    }
  }
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function turkceBuyut(s: string): string {
  return s.toLocaleUpperCase("tr-TR").trim();
}

export async function iceAktarMagazaBilgisi(rows: MagazaBilgisiSatiri[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, ad_soyad, rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  if (rows.length === 0) return { basarili: 0, hatalar: [{ satir: 0, hata: "Dosyada okunabilir satır bulunamadı." }] };

  const { data: magazalarHam } = await supabase.from("magazalar").select("id, magaza_kodu, bolge_id");
  const magazaMap: Record<string, { id: string; bolge_id: string | null }> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaMap[m.magaza_kodu] = { id: m.id, bolge_id: m.bolge_id }; });

  const { data: bolgelerHam } = await supabase.from("bolgeler").select("id, ad");
  const bolgeMap: Record<string, string> = {};
  (bolgelerHam ?? []).forEach((b: any) => { bolgeMap[b.ad] = b.id; });

  let basarili = 0;
  const hatalar: SatirHata[] = [];
  const performansHaritasi = new Map<string, { magaza_id: string; yil: number; ay: number; [k: string]: any }>();
  // Mevcut mağazalarda SUBETIPI/NETM2 güncellemesi artık satır satır değil, sona toplu yazılıyor.
  const magazaGuncellemeleri = new Map<string, { id: string; subetipi?: string | null; net_m2?: number | null }>();

  for (let i = 0; i < rows.length; i++) {
    const satirNo = i + 4; // dosyada 3 başlık satırı var, veri 4. satırdan başlıyor
    const r = rows[i];

    const subeHam = String(r.sube_listesi ?? "").trim();
    if (!subeHam || turkceBuyut(subeHam) === "TOTAL") {
      // Dosyanın en altındaki genel toplam satırı veya tamamen boş satır — hata değil, sessizce atla.
      continue;
    }

    const { kod: magazaKodu, ad: magazaAdi } = magazaKoduAyikla(subeHam);
    if (!magazaKodu) {
      hatalar.push({ satir: satirNo, hata: "Şube Listesi alanı okunamadı." });
      continue;
    }

    const bolgeAdi = String(r.bolge_listesi ?? "").trim();
    const subetipi = String(r.subetipi ?? "").trim() || null;
    const netm2 = sayi(r.netm2);

    let magaza = magazaMap[magazaKodu];

    if (!magaza) {
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
      const guncelleme: { id: string; subetipi?: string | null; net_m2?: number | null } = { id: magaza.id };
      if (subetipi !== null) guncelleme.subetipi = subetipi;
      if (netm2 !== null) guncelleme.net_m2 = netm2;
      magazaGuncellemeleri.set(magaza.id, guncelleme);
    }

    let buSatirdaEnAzBirDeger = false;
    for (const metrik of r.metrikler ?? []) {
      const alan = ALAN_ESLEME[metrik.alan];
      if (!alan) continue;
      const deger = sayi(metrik.deger);
      if (deger === null) continue;
      buSatirdaEnAzBirDeger = true;
      const anahtar = `${magaza.id}|${metrik.yil}|${metrik.ay}`;
      if (!performansHaritasi.has(anahtar)) {
        performansHaritasi.set(anahtar, { magaza_id: magaza.id, yil: metrik.yil, ay: metrik.ay });
      }
      performansHaritasi.get(anahtar)![alan] = deger;
    }

    if (buSatirdaEnAzBirDeger) basarili++;
    else hatalar.push({ satir: satirNo, hata: "Bu mağaza için okunabilir hiçbir aylık metrik değeri bulunamadı (yeni açılan mağazalarda normal olabilir)." });
  }

  if (magazaGuncellemeleri.size > 0) {
    const { error: guncelleHata } = await supabase.rpc("magazalar_toplu_guncelle", {
      p_guncellemeler: Array.from(magazaGuncellemeleri.values()),
    });
    if (guncelleHata) {
      hatalar.push({ satir: 0, hata: "Mağaza bilgileri (SUBETIPI/NETM2) toplu güncellenemedi: " + guncelleHata.message });
    }
  }

  if (performansHaritasi.size > 0) {
    const satirlar = Array.from(performansHaritasi.values());
    // Supabase tek istekte makul boyutta array upsert kabul eder; çok büyük dosyalarda 500'lük parçalara bölüyoruz.
    const PARCA = 500;
    for (let i = 0; i < satirlar.length; i += PARCA) {
      const dilim = satirlar.slice(i, i + PARCA);
      const { error: upsertHata } = await supabase
        .from("performans_magaza_aylik")
        .upsert(dilim, { onConflict: "magaza_id,yil,ay" });
      if (upsertHata) {
        return { basarili: 0, hatalar: [{ satir: 0, hata: "Performans verileri kaydedilemedi: " + upsertHata.message }] };
      }
    }
  }

  revalidatePath("/norm");
  revalidatePath("/raporlar");
  revalidatePath("/dashboard");
  return { basarili, hatalar };
}
