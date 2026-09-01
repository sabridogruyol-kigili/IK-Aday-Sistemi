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

    if (!magazaKodu || !magazaAdi || !bolgeAdi) {
      hatalar.push({ satir: satirNo, hata: "Mağaza Kodu, Mağaza Adı veya Bölge Adı eksik." });
      continue;
    }
    if ([anaKadro, donemsel, partTime].some((v) => Number.isNaN(v) || v < 0)) {
      hatalar.push({ satir: satirNo, hata: "Norm sayıları geçersiz (boş veya negatif olamaz)." });
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

    const { data: magaza, error: magazaHata } = await supabase
      .from("magazalar")
      .upsert({ magaza_kodu: magazaKodu, magaza_adi: magazaAdi, bolge_id: bolge.id, aktif: true }, { onConflict: "magaza_kodu" })
      .select("id")
      .single();
    if (magazaHata || !magaza) {
      hatalar.push({ satir: satirNo, hata: "Mağaza kaydedilemedi: " + magazaHata?.message });
      continue;
    }

    const { error: normHata } = await supabase
      .from("norm")
      .upsert(
        { magaza_id: magaza.id, ana_kadro_norm: anaKadro, donemsel_norm: donemsel, part_time_norm: partTime, kaynak: "import" },
        { onConflict: "magaza_id" }
      );
    if (normHata) {
      hatalar.push({ satir: satirNo, hata: "Norm kaydedilemedi: " + normHata.message });
      continue;
    }

    basarili++;
  }

  await supabase.from("import_gecmisi").insert({
    tip: "norm", kullanici_id: me.id, kullanici_adi: me.ad_soyad, basarili, hatali: hatalar.length,
  });

  revalidatePath("/dashboard");
  revalidatePath("/norm");
  return { basarili, hatalar };
}
