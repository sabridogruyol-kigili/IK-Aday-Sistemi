"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

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

function parcala<T>(dizi: T[], boyut: number): T[][] {
  const parcalar: T[][] = [];
  for (let i = 0; i < dizi.length; i += boyut) parcalar.push(dizi.slice(i, i + boyut));
  return parcalar;
}

export async function iceAktarTurnover(rows: any[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  const { data: magazalarHam } = await supabase.from("magazalar").select("id, magaza_kodu");
  const magazaMap: Record<string, string> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaMap[m.magaza_kodu] = m.id; });

  const hatalar: SatirHata[] = [];
  const guncellemeler: { id: string; istifa_turnover: number | null; fesih_turnover: number | null; toplam_turnover: number | null }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const satirNo = i + 2;
    const r = rows[i];

    const magazaKodu = String(r["Mağaza Kodu"] ?? "").trim();
    if (!magazaKodu) {
      hatalar.push({ satir: satirNo, hata: "Mağaza Kodu eksik." });
      continue;
    }
    const magazaId = magazaMap[magazaKodu];
    if (!magazaId) {
      hatalar.push({ satir: satirNo, hata: `Mağaza Kodu (${magazaKodu}) sistemde tanımlı değil.` });
      continue;
    }

    const istifa = sayi(r["İstifa Turnover"]);
    const fesih = sayi(r["Fesih Turnover"]);
    const toplam = sayi(r["Toplam Turnover"]);

    if (istifa === null && fesih === null && toplam === null) {
      hatalar.push({ satir: satirNo, hata: "İstifa, Fesih veya Toplam Turnover alanlarının hiçbiri okunamadı." });
      continue;
    }

    guncellemeler.push({ id: magazaId, istifa_turnover: istifa, fesih_turnover: fesih, toplam_turnover: toplam });
  }

  let basarili = 0;
  const PARCA_BOYUTU = 300;
  for (const parca of parcala(guncellemeler, PARCA_BOYUTU)) {
    const { error } = await supabase.rpc("magazalar_turnover_guncelle", { p_guncellemeler: parca });
    if (error) {
      parca.forEach(() => hatalar.push({ satir: 0, hata: "Turnover güncellenemedi: " + error.message }));
    } else {
      basarili += parca.length;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/norm");
  return { basarili, hatalar };
}
