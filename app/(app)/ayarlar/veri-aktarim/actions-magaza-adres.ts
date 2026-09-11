"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

function sutunAl(r: any, adaylar: string[]): any {
  for (const ad of adaylar) {
    if (r[ad] !== undefined && r[ad] !== null && r[ad] !== "") return r[ad];
  }
  return undefined;
}

// Şablon: Mağaza Kodu, Mağaza Adı (bilgi amaçlı, eşleşme Mağaza Kodu ile
// yapılır), Mağaza Adresi, Mağaza Konumu (Google Maps bağlantısı). Mağaza
// sistemde önceden kayıtlı olmalı — bu import yeni mağaza oluşturmaz.
export async function iceAktarMagazaAdresKonum(rows: any[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  let basarili = 0;
  const hatalar: SatirHata[] = [];

  for (let i = 0; i < rows.length; i++) {
    const satirNo = i + 2;
    const r = rows[i];
    const magazaKodu = String(sutunAl(r, ["Mağaza Kodu", "Magaza Kodu", "MAĞAZA KODU", "Şube Kodu"]) ?? "").trim();
    const adres = String(sutunAl(r, ["Mağaza Adresi", "Adres", "Magaza Adresi"]) ?? "").trim();
    const konumLink = String(sutunAl(r, ["Mağaza Konumu", "Konum", "Konum Linki", "Google Maps"]) ?? "").trim();

    if (!magazaKodu) {
      hatalar.push({ satir: satirNo, hata: "Mağaza Kodu eksik." });
      continue;
    }
    if (!adres && !konumLink) {
      hatalar.push({ satir: satirNo, hata: "Adres veya Konum alanlarından en az biri dolu olmalı." });
      continue;
    }

    const { data: magaza } = await supabase.from("magazalar").select("id").eq("magaza_kodu", magazaKodu).maybeSingle();
    if (!magaza) {
      hatalar.push({ satir: satirNo, hata: `Mağaza (${magazaKodu}) sistemde kayıtlı değil.` });
      continue;
    }

    const guncelleme: any = {};
    if (adres) guncelleme.adres = adres;
    if (konumLink) guncelleme.konum_link = konumLink;

    const { error } = await supabase.from("magazalar").update(guncelleme).eq("id", magaza.id);
    if (error) {
      hatalar.push({ satir: satirNo, hata: "Güncellenemedi: " + error.message });
      continue;
    }
    basarili++;
  }

  revalidatePath("/ayarlar/sistem");
  return { basarili, hatalar };
}
