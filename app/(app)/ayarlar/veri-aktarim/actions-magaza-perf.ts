"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

const HARIC_MAGAZA_KODLARI = new Set(["A400", "A401", "A402", "A405", "C400"]);

const AY_INGILIZCE_MAP: Record<string, number> = {
  "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
  "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
};

function ayCoz(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v >= 1 && v <= 12 ? v : null;
  const s = String(v).trim().toLocaleLowerCase("en-US").slice(0, 3);
  return AY_INGILIZCE_MAP[s] ?? null;
}

function sayi(v: any): number | null {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else {
    let s = String(v).trim().replace(/[₺$%\s]/g, "");
    if (s === "-" || s === "") return null;
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
      n = Number(s.replace(/\./g, "").replace(",", "."));
    } else {
      n = Number(s.replace(",", "."));
    }
  }
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function tarihCoz(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parcala<T>(dizi: T[], boyut: number): T[][] {
  const parcalar: T[][] = [];
  for (let i = 0; i < dizi.length; i += boyut) parcalar.push(dizi.slice(i, i + boyut));
  return parcalar;
}

export async function iceAktarMagazaPerformans2(rows: any[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, ad_soyad, rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  const { data: magazalarHam } = await supabase.from("magazalar").select("id, magaza_kodu, magaza_adi");
  const magazaMap: Record<string, string> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaMap[m.magaza_kodu] = m.id; });

  const { data: bolgelerHam } = await supabase.from("bolgeler").select("id, ad");
  const bolgeMap: Record<string, string> = {};
  (bolgelerHam ?? []).forEach((b: any) => { bolgeMap[b.ad] = b.id; });

  const hatalar: SatirHata[] = [];
  const magazaAylikSatirlari: Record<string, any>[] = [];

  // Aynı mağaza için birden fazla ay olabilir; bölge her zaman dosyadaki EN GÜNCEL
  // (en büyük yıl-ay) satırdan alınır — dosyanın satır sırasına güvenilmez.
  const magazaGuncellemeleri = new Map<string, {
    id: string; enSonDonem: number; bolge_id: string; il_adi: string | null; subetipi: string | null; net_m2: number | null;
  }>();

  async function bolgeIdCoz(ad: string, satirNo: number): Promise<string | null> {
    if (!ad) return null;
    const mevcut = bolgeMap[ad];
    if (mevcut) return mevcut;
    const { data: yeniBolge, error: bolgeHata } = await supabase.from("bolgeler").insert({ ad }).select("id").single();
    if (bolgeHata || !yeniBolge) {
      hatalar.push({ satir: satirNo, hata: `Bölge (${ad}) oluşturulamadı: ` + bolgeHata?.message });
      return null;
    }
    bolgeMap[ad] = yeniBolge.id;
    return yeniBolge.id;
  }

  for (let i = 0; i < rows.length; i++) {
    const satirNo = i + 2;
    const r = rows[i];

    const yil = sayi(r["📆 Year"]);
    const ay = ayCoz(r["📆MonthName"]);
    const magazaKodu = String(r["🏬StoreCode"] ?? "").trim();

    if (!yil || !ay || !magazaKodu) {
      hatalar.push({ satir: satirNo, hata: "Year, MonthName veya StoreCode alanı eksik/okunamadı." });
      continue;
    }
    if (HARIC_MAGAZA_KODLARI.has(magazaKodu)) continue;

    let magazaId = magazaMap[magazaKodu];
    const bolgeAdi = String(r["🏬RegionList"] ?? "").trim();
    // NOT: Daha önce burada isimden kod öneki siliniyordu ("C025 ..." -> "...").
    // Bu YANLIŞTI — dosyadaki StoreFullName zaten doğru (kodlu) geliyor, silmeye
    // hiç gerek yoktu. Bu yüzden yeni oluşan mağazalar kodsuz, eskiler kodlu
    // kalıyordu. Artık dosyadaki isim olduğu gibi kullanılıyor.
    const magazaAdi = String(r["🏬StoreFullName"] ?? "").trim();
    const donemKodu = yil * 100 + ay;

    if (!magazaId) {
      const bolgeId = await bolgeIdCoz(bolgeAdi, satirNo);
      const { data: yeniMagaza, error: magazaHata } = await supabase
        .from("magazalar")
        .insert({
          magaza_kodu: magazaKodu, magaza_adi: magazaAdi || magazaKodu, bolge_id: bolgeId,
          il_adi: String(r["🏬CityName"] ?? "").trim() || null,
          subetipi: String(r["🏬StoreSegment"] ?? "").trim() || null,
          net_m2: sayi(r["StoreSalesArea"]),
          acilis_tarihi: tarihCoz(r["🏬StoreOpeningDate"]),
          aktif: true,
        })
        .select("id")
        .single();
      if (magazaHata || !yeniMagaza) { hatalar.push({ satir: satirNo, hata: `Mağaza (${magazaKodu}) oluşturulamadı: ` + magazaHata?.message }); continue; }
      magazaId = yeniMagaza.id;
      magazaMap[magazaKodu] = magazaId;
    } else if (bolgeAdi) {
      const mevcutAday = magazaGuncellemeleri.get(magazaId);
      if (!mevcutAday || donemKodu > mevcutAday.enSonDonem) {
        const bolgeId = await bolgeIdCoz(bolgeAdi, satirNo);
        if (bolgeId) {
          magazaGuncellemeleri.set(magazaId, {
            id: magazaId, enSonDonem: donemKodu, bolge_id: bolgeId,
            il_adi: String(r["🏬CityName"] ?? "").trim() || null,
            subetipi: String(r["🏬StoreSegment"] ?? "").trim() || null,
            net_m2: sayi(r["StoreSalesArea"]),
          });
        }
      }
    }

    const netSatis = sayi(r["Net Sales Amount(VI+OMS+ThrdCard+Cntr)"]);
    const netAdet = sayi(r["Sales Quantity(+OMS+Cntr)"]);
    const ciroHedef = sayi(r["Target Net Amount- Store"]);
    const adetHedef = sayi(r["Target Sales Quantity"]);
    const hgoCiro = netSatis !== null && ciroHedef ? Math.round((netSatis / ciroHedef) * 10000) / 100 : null;
    const hgoAdet = netAdet !== null && adetHedef ? Math.round((netAdet / adetHedef) * 10000) / 100 : null;

    magazaAylikSatirlari.push({
      magaza_id: magazaId, yil, ay,
      hgo: hgoCiro, adet_hgo: hgoAdet,
      sepet_ortalamasi: sayi(r["ATV"]), sepet_derinligi: sayi(r["UPT"]),
      donusum_orani: sayi(r["ConversionRate"]), giren_musteri_sayisi: sayi(r["Visitors"]),
      toplam_ciro_kdv_dahil: netSatis, satis_adeti: netAdet,
      omnichannel_ciro: sayi(r["OMS_NetSalesAmount(VI)"]),
      magaza_ciro_hedef: ciroHedef, magaza_adet_hedef: adetHedef,
      brut_kar_marji: sayi(r["Gross Profit Margin"]), fis_sayisi: sayi(r["Gross Transaction Count"]),
    });
  }

  if (magazaGuncellemeleri.size > 0) {
    const guncellemeListesi = Array.from(magazaGuncellemeleri.values()).map(({ enSonDonem, ...rest }) => rest);
    const { error } = await supabase.rpc("magazalar_toplu_guncelle_v2", { p_guncellemeler: guncellemeListesi });
    if (error) hatalar.push({ satir: 0, hata: "Mağaza bilgileri (bölge dahil) toplu güncellenemedi: " + error.message });
  }

  let basarili = 0;
  const PARCA_BOYUTU = 1000;
  for (const parca of parcala(magazaAylikSatirlari, PARCA_BOYUTU)) {
    const { error } = await supabase.from("performans_magaza_aylik").upsert(parca, { onConflict: "magaza_id,yil,ay" });
    if (error) hatalar.push({ satir: 0, hata: "Mağaza aylık veri kaydında hata: " + error.message });
    else basarili += parca.length;
  }

  // Sistemdeki EN GÜNCEL dönem baz alınır (sadece bu importtaki değil, tüm veri
  // setindeki en son yıl-ay). O dönemde veri veren mağaza aktif, vermeyen mağaza
  // (örn. kodu değişmiş/kapanmış eski kayıt) otomatik pasif işaretlenir — isim
  // eşleştirmesi gerekmeden, "en güncel veri neyse o geçerli" prensibiyle.
  const { data: tumDonemler } = await supabase.from("performans_magaza_aylik").select("yil, ay").order("yil", { ascending: false }).order("ay", { ascending: false }).limit(1);
  if (tumDonemler && tumDonemler.length > 0) {
    const enSonYil = tumDonemler[0].yil;
    const enSonAy = tumDonemler[0].ay;

    const { data: enSonDonemVerenler } = await supabase
      .from("performans_magaza_aylik")
      .select("magaza_id")
      .eq("yil", enSonYil)
      .eq("ay", enSonAy);
    const aktifKalmasiGerekenler = new Set((enSonDonemVerenler ?? []).map((r: any) => r.magaza_id));

    const { data: tumMagazalar } = await supabase.from("magazalar").select("id, aktif");
    const pasifeAlinacaklar = (tumMagazalar ?? []).filter((m: any) => m.aktif && !aktifKalmasiGerekenler.has(m.id)).map((m: any) => m.id);
    const aktifeAlinacaklar = (tumMagazalar ?? []).filter((m: any) => !m.aktif && aktifKalmasiGerekenler.has(m.id)).map((m: any) => m.id);

    for (const parca of parcala(pasifeAlinacaklar, 500)) {
      await supabase.from("magazalar").update({ aktif: false }).in("id", parca);
    }
    for (const parca of parcala(aktifeAlinacaklar, 500)) {
      await supabase.from("magazalar").update({ aktif: true }).in("id", parca);
    }
  }

  await supabase.from("import_gecmisi").insert({ tip: "magaza_performans2", kullanici_id: me.id, kullanici_adi: me.ad_soyad, basarili, hatali: hatalar.length });

  revalidatePath("/raporlar");
  revalidatePath("/dashboard");
  revalidatePath("/ayarlar/magazalar");
  return { basarili, hatalar };
}
