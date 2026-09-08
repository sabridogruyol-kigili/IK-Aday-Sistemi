"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

export async function iceAktarMagazaNorm(rows: any[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, ad_soyad, rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  let basarili = 0;
  const hatalar: SatirHata[] = [];

  for (let i = 0; i < rows.length; i++) {
    const satirNo = i + 2;
    const r = rows[i];
    const magazaKodu = String(r["Mağaza Kodu"] ?? "").trim();
    const magazaAdi = String(r["Mağaza Adı"] ?? "").trim();
    const bolgeAdi = String(r["Bölge Adı"] ?? "").trim();
    const anaKadro = Number(r["Ana Kadro Norm"]);
    const donemsel = Number(r["Dönemsel Norm"]);
    const partTime = Number(r["Part-Time Norm"]);

    if (!magazaKodu || !magazaAdi) {
      hatalar.push({ satir: satirNo, hata: "Mağaza Kodu veya Mağaza Adı eksik." });
      continue;
    }
    if ([anaKadro, donemsel, partTime].some((v) => Number.isNaN(v) || v < 0)) {
      hatalar.push({ satir: satirNo, hata: "Norm sayıları geçersiz (boş veya negatif olamaz)." });
      continue;
    }

    // Mağaza sistemde zaten varsa, bölgesi Mağaza Performans dosyasından geldiği kabul
    // edilir — bu dosyanın kendi Bölge Adı sütunu görmezden gelinir (aynı bölgenin farklı
    // yazımlarla mükerrer oluşmasını önler). Mağaza gerçekten yeniyse, bölgeye ihtiyaç
    // olduğu için bu dosyadaki Bölge Adı kullanılır.
    const { data: mevcutMagaza } = await supabase.from("magazalar").select("id, bolge_id").eq("magaza_kodu", magazaKodu).maybeSingle();

    let magazaId: string;
    if (mevcutMagaza) {
      const { error: guncelleHata } = await supabase.from("magazalar").update({ magaza_adi: magazaAdi }).eq("id", mevcutMagaza.id);
      if (guncelleHata) {
        hatalar.push({ satir: satirNo, hata: "Mağaza güncellenemedi: " + guncelleHata.message });
        continue;
      }
      magazaId = mevcutMagaza.id;
    } else {
      if (!bolgeAdi) {
        hatalar.push({ satir: satirNo, hata: `Mağaza (${magazaKodu}) sistemde yok ve Bölge Adı boş olduğu için oluşturulamadı.` });
        continue;
      }
      let { data: bolge } = await supabase.from("bolgeler").select("id").eq("ad", bolgeAdi).single();
      if (!bolge) {
        const { data: yeniBolge, error: bolgeHata } = await supabase
          .from("bolgeler").insert({ ad: bolgeAdi }).select("id").single();
        if (bolgeHata || !yeniBolge) {
          hatalar.push({ satir: satirNo, hata: "Bölge oluşturulamadı: " + bolgeHata?.message });
          continue;
        }
        bolge = yeniBolge;
      }

      const { data: yeniMagaza, error: magazaHata } = await supabase
        .from("magazalar")
        .insert({ magaza_kodu: magazaKodu, magaza_adi: magazaAdi, bolge_id: bolge.id, aktif: true })
        .select("id")
        .single();
      if (magazaHata || !yeniMagaza) {
        hatalar.push({ satir: satirNo, hata: "Mağaza kaydedilemedi: " + magazaHata?.message });
        continue;
      }
      magazaId = yeniMagaza.id;
    }

    const { error: normHata } = await supabase
      .from("norm")
      .upsert(
        { magaza_id: magazaId, ana_kadro_norm: anaKadro, donemsel_norm: donemsel, part_time_norm: partTime, kaynak: "import" },
        { onConflict: "magaza_id" }
      );
    if (normHata) {
      hatalar.push({ satir: satirNo, hata: "Norm kaydedilemedi: " + normHata.message });
      continue;
    }

    basarili++;
  }

  revalidatePath("/dashboard");
  revalidatePath("/norm");
  revalidatePath("/ayarlar/magazalar");
  return { basarili, hatalar };
}
