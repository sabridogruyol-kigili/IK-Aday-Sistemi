"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

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

// Personel Kodu / Sicil kimi dosyada metin ("008144"), kimi dosyada Excel'in
// sayı+özel biçim olarak yazdığı bir değer ("8144") olarak gelebilir. Baştaki
// sıfırlar her zaman kaldırılır ki iki farklı dosyadan gelen aynı kişi eşleşsin.
function sicilNormalize(kod: string): string {
  const s = String(kod ?? "").trim().replace(/\.0$/, "").replace(/-\d+$/, "");
  const sifirsiz = s.replace(/^0+(?=\d)/, "");
  return sifirsiz || s;
}

function turkceBuyut(s: string): string {
  return s.toLocaleUpperCase("tr-TR").trim();
}

function parcala<T>(dizi: T[], boyut: number): T[][] {
  const parcalar: T[][] = [];
  for (let i = 0; i < dizi.length; i += boyut) parcalar.push(dizi.slice(i, i + boyut));
  return parcalar;
}

export async function iceAktarCalisanPerformans(rows: any[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, ad_soyad, rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  const { data: magazalarHam } = await supabase.from("magazalar").select("id, magaza_kodu");
  const magazaMap: Record<string, string> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaMap[m.magaza_kodu] = m.id; });

  const { data: unvanlarHam } = await supabase.from("unvan_kadro_kategorisi").select("unvan, kategori");
  const unvanMap: Record<string, string> = {};
  (unvanlarHam ?? []).forEach((u: any) => { unvanMap[turkceBuyut(u.unvan)] = u.kategori; });

  // KRİTİK: Supabase tek sorguda en fazla 1000 satır döndürür. Bu sayfalama
  // olmadan, 1000'den fazla personel varsa geri kalanlar personelMap'e hiç
  // girmiyordu — bu da onların sicili her import edildiğinde "eksik" sanılıp
  // HER SEFERİNDE yeni bir mükerrer (PLASIYER-) hayalet kayıt oluşmasına yol
  // açıyordu (aynı kişi için tekrar tekrar).
  const personelHam: { id: string; personel_kodu: string | null }[] = [];
  {
    const PARCA = 1000;
    let sayfa = 0;
    while (true) {
      const bas = sayfa * PARCA;
      const { data } = await supabase.from("personel").select("id, personel_kodu").range(bas, bas + PARCA - 1);
      if (!data || data.length === 0) break;
      personelHam.push(...(data as any[]));
      if (data.length < PARCA) break;
      sayfa++;
    }
  }
  const personelMap: Record<string, string> = {};
  (personelHam ?? []).forEach((p: any) => { if (p.personel_kodu) personelMap[sicilNormalize(p.personel_kodu)] = p.id; });

  const hatalar: SatirHata[] = [];
  type KisiSatirHam = { sicil: string; yil: number; ay: number; hedef_ciro: number | null; gerceklesen_ciro: number | null; hedef_adet: number | null; gerceklesen_adet: number | null; brut_kar_marji: number | null; brut_satis_adeti: number | null };
  const kisiSatirlarHam: KisiSatirHam[] = [];
  const eksikPersonel = new Map<string, { ad: string; unvan: string; kategori: string | null; magazaId: string }>();

  for (let i = 0; i < rows.length; i++) {
    const satirNo = i + 2;
    const r = rows[i];

    const yil = sayi(r["📆 Year"]);
    const ay = ayCoz(r["📆MonthName"]);
    const magazaKodu = String(r["🏬StoreCode"] ?? "").trim();
    const sicilHam = r["🤵SalespersonCode"];

    if (!yil || !ay || !magazaKodu) {
      hatalar.push({ satir: satirNo, hata: "Year, MonthName veya StoreCode alanı eksik/okunamadı." });
      continue;
    }
    if (sicilHam === null || sicilHam === undefined || sicilHam === "") {
      hatalar.push({ satir: satirNo, hata: "SalespersonCode eksik." });
      continue;
    }

    const magazaId = magazaMap[magazaKodu];
    if (!magazaId) {
      hatalar.push({ satir: satirNo, hata: `Mağaza kodu (${magazaKodu}) sistemde tanımlı değil — önce Mağaza Performans dosyasını içe aktarın.` });
      continue;
    }

    const sicil = sicilNormalize(String(sicilHam));
    const adSoyad = String(r["🤵SalesPersonName"] ?? "").trim();
    const tamUnvan = String(r["🤵TitleName"] ?? "").trim();
    const kategori = unvanMap[turkceBuyut(tamUnvan)] ?? null;

    if (!personelMap[sicil] && !eksikPersonel.has(sicil)) {
      eksikPersonel.set(sicil, { ad: adSoyad || sicil, unvan: tamUnvan, kategori, magazaId });
    }

    kisiSatirlarHam.push({
      sicil, yil, ay,
      hedef_ciro: sayi(r["Target Net Amount- SalesPerson"]), gerceklesen_ciro: sayi(r["Net Sales Amount(VI+OMS+ThrdCard+Cntr)"]),
      hedef_adet: sayi(r["Target Sales Quantity-SalesPerson"]), gerceklesen_adet: sayi(r["Sales Quantity(+OMS+Cntr)"]),
      brut_kar_marji: sayi(r["Gross Profit Margin"]), brut_satis_adeti: sayi(r["GrossSalesQuantity"]),
    });
  }

  if (eksikPersonel.size > 0) {
    const placeholderlarHam: { id: string; personel_kodu: string | null }[] = [];
    {
      const PARCA = 1000;
      let sayfa = 0;
      while (true) {
        const bas = sayfa * PARCA;
        const { data } = await supabase.from("personel").select("id, personel_kodu").like("tc_kimlik_no", "PLASIYER-%").range(bas, bas + PARCA - 1);
        if (!data || data.length === 0) break;
        placeholderlarHam.push(...(data as any[]));
        if (data.length < PARCA) break;
        sayfa++;
      }
    }
    const placeholderMap: Record<string, string> = {};
    (placeholderlarHam ?? []).forEach((p: any) => { if (p.personel_kodu) placeholderMap[p.personel_kodu] = p.id; });

    const birlestirilecekler: { id: string; sicil: string }[] = [];
    const yeniEklenecekler: { sicil: string; bilgi: { ad: string; unvan: string; kategori: string | null; magazaId: string } }[] = [];
    eksikPersonel.forEach((bilgi, sicil) => {
      if (placeholderMap[sicil]) birlestirilecekler.push({ id: placeholderMap[sicil], sicil });
      else yeniEklenecekler.push({ sicil, bilgi });
    });

    for (const parca of parcala(birlestirilecekler, 300)) {
      const guncellemeler = parca.map((p) => {
        const bilgi = eksikPersonel.get(p.sicil)!;
        return { id: p.id, ad_soyad: bilgi.ad, guncel_unvan: bilgi.unvan, kadro_kategorisi: bilgi.kategori, guncel_magaza_id: bilgi.magazaId };
      });
      const { error } = await supabase.rpc("personel_placeholder_birlestir_basit", { p_guncellemeler: guncellemeler });
      if (error) hatalar.push({ satir: 0, hata: "Yer tutucu personel birleştirilemedi: " + error.message });
      else parca.forEach((p) => { personelMap[p.sicil] = p.id; });
    }

    for (const parca of parcala(yeniEklenecekler, 500)) {
      const { data: eklenenler, error } = await supabase
        .from("personel")
        .upsert(
          parca.map((p) => ({
            tc_kimlik_no: `PLASIYER-${p.sicil}`, personel_kodu: p.sicil, ad_soyad: p.bilgi.ad,
            guncel_unvan: p.bilgi.unvan, kadro_kategorisi: p.bilgi.kategori, guncel_magaza_id: p.bilgi.magazaId, durum: "aktif",
          })),
          { onConflict: "tc_kimlik_no" }
        )
        .select("id, personel_kodu");
      if (error) hatalar.push({ satir: 0, hata: "Yeni personel oluşturulamadı: " + error.message });
      else (eklenenler ?? []).forEach((p: any) => { if (p.personel_kodu) personelMap[p.personel_kodu] = p.id; });
    }
  }

  // Aynı kişi aynı ay için birden fazla satır olabilir (örn. ay içinde mağaza değiştirme) —
  // bunlar aynı toplu upsert içinde çakışıp hata verir. Toplanıp tek satıra indirilir,
  // HGO da toplam üzerinden yeniden hesaplanır.
  const kisiAylikMap = new Map<string, {
    personel_id: string; yil: number; ay: number;
    hedef_ciro: number; gerceklesen_ciro: number; hedef_adet: number; gerceklesen_adet: number;
    brut_kar_marji_toplam: number; brut_kar_marji_sayi: number; brut_satis_adeti: number;
  }>();

  for (const satir of kisiSatirlarHam) {
    const personelId = personelMap[satir.sicil];
    if (!personelId) { hatalar.push({ satir: 0, hata: `Sicil (${satir.sicil}) için personel bulunamadı/oluşturulamadı, atlandı.` }); continue; }

    const anahtar = `${personelId}|${satir.yil}|${satir.ay}`;
    if (!kisiAylikMap.has(anahtar)) {
      kisiAylikMap.set(anahtar, {
        personel_id: personelId, yil: satir.yil, ay: satir.ay,
        hedef_ciro: 0, gerceklesen_ciro: 0, hedef_adet: 0, gerceklesen_adet: 0,
        brut_kar_marji_toplam: 0, brut_kar_marji_sayi: 0, brut_satis_adeti: 0,
      });
    }
    const g = kisiAylikMap.get(anahtar)!;
    g.hedef_ciro += satir.hedef_ciro ?? 0;
    g.gerceklesen_ciro += satir.gerceklesen_ciro ?? 0;
    g.hedef_adet += satir.hedef_adet ?? 0;
    g.gerceklesen_adet += satir.gerceklesen_adet ?? 0;
    g.brut_satis_adeti += satir.brut_satis_adeti ?? 0;
    if (satir.brut_kar_marji !== null) { g.brut_kar_marji_toplam += satir.brut_kar_marji; g.brut_kar_marji_sayi += 1; }
  }

  const kisiAylikSatirlari = Array.from(kisiAylikMap.values()).map((g) => ({
    personel_id: g.personel_id, yil: g.yil, ay: g.ay,
    hedef_ciro_kdv_dahil: g.hedef_ciro, gerceklesen_ciro_kdv_dahil: g.gerceklesen_ciro,
    hedef_adet: g.hedef_adet, gerceklesen_adet: g.gerceklesen_adet,
    hgo: g.hedef_ciro > 0 ? Math.round((g.gerceklesen_ciro / g.hedef_ciro) * 10000) / 100 : null,
    adet_hgo: g.hedef_adet > 0 ? Math.round((g.gerceklesen_adet / g.hedef_adet) * 10000) / 100 : null,
    brut_kar_marji: g.brut_kar_marji_sayi > 0 ? Math.round((g.brut_kar_marji_toplam / g.brut_kar_marji_sayi) * 100) / 100 : null,
    brut_satis_adeti: g.brut_satis_adeti,
  }));

  let basarili = 0;
  const PARCA_BOYUTU = 1000;
  for (const parca of parcala(kisiAylikSatirlari, PARCA_BOYUTU)) {
    const { error } = await supabase.from("performans_kisi_aylik").upsert(parca, { onConflict: "personel_id,yil,ay" });
    if (error) hatalar.push({ satir: 0, hata: "Kişi aylık veri kaydında hata: " + error.message });
    else basarili += parca.length;
  }

  const etkilenenPersonelIdleri = Array.from(new Set(kisiAylikSatirlari.map((s) => s.personel_id)));
  const tumAylar: { personel_id: string; hgo: number | null }[] = [];
  for (const parca of parcala(etkilenenPersonelIdleri, PARCA_BOYUTU)) {
    const { data } = await supabase.from("performans_kisi_aylik").select("personel_id, hgo").in("personel_id", parca).not("hgo", "is", null);
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
      id: personelId, performans_ortalama_hgo: ortalama,
      performans_80_alti_sayisi: degerler.filter((v) => v < 80).length,
      performans_80_100_arasi_sayisi: degerler.filter((v) => v >= 80 && v <= 100).length,
      performans_100_ustu_sayisi: degerler.filter((v) => v > 100).length,
    };
  });
  for (const parca of parcala(personelGuncellemeleri, PARCA_BOYUTU)) {
    const { error } = await supabase.rpc("personel_performans_ozet_guncelle", { p_guncellemeler: parca });
    if (error) hatalar.push({ satir: 0, hata: "Personel performans özeti güncellenemedi: " + error.message });
  }

  // Aynı personel_kodu'na sahip birden fazla AKTİF kayıt varsa (örn. biri
  // "PLASIYER-" yer tutucu, biri gerçek TC'li), isme VE performans verisine
  // bakılmadan (dönemsel kadro bazı aylarda hiç performans vermeyebilir, bu
  // riskli bir sinyal olur) sadece TEK kritere göre karar verilir: gerçek TC'li
  // (Personel dosyasından doğrulanmış) kayıt aktif kalır, PLASIYER- yer tutucu
  // olan otomatik pasif yapılır. Bu kontrol SADECE bu importa giren kişilerle
  // sınırlı değildir — sistemdeki TÜM personel_kodu grupları taranır.
  {
    const { data: aktifPersonel } = await supabase
      .from("personel")
      .select("id, personel_kodu, tc_kimlik_no")
      .eq("durum", "aktif")
      .not("personel_kodu", "is", null);

    const koduGrupla = new Map<string, { id: string; gercekMi: boolean }[]>();
    (aktifPersonel ?? []).forEach((p: any) => {
      if (!koduGrupla.has(p.personel_kodu)) koduGrupla.set(p.personel_kodu, []);
      koduGrupla.get(p.personel_kodu)!.push({ id: p.id, gercekMi: !String(p.tc_kimlik_no ?? "").startsWith("PLASIYER-") });
    });

    const pasifeAlinacaklar: string[] = [];
    koduGrupla.forEach((kayitlar) => {
      if (kayitlar.length <= 1) return; // mükerrer yok
      // Gerçek TC'li kayıt varsa o kalıcı. Hiçbiri gerçek değilse (hepsi
      // PLASIYER- ise) bile istisna yapılmaz — id sırasına göre ilk kayıt
      // kalıcı kabul edilir, geri kalanı pasife alınır. Amaç: mükerrer sayının
      // her zaman TEK aktif kayda inmesi, veri kalitesi ne olursa olsun.
      const gercekOlanlar = kayitlar.filter((k) => k.gercekMi);
      const kalici = gercekOlanlar.length > 0 ? gercekOlanlar[0] : kayitlar.sort((a, b) => a.id.localeCompare(b.id))[0];
      kayitlar.forEach((k) => { if (k.id !== kalici.id) pasifeAlinacaklar.push(k.id); });
    });

    for (const parca of parcala(pasifeAlinacaklar, 500)) {
      await supabase.from("personel").update({ durum: "pasif" }).in("id", parca);
    }
  }

  await supabase.from("import_gecmisi").insert({ tip: "calisan_performans", kullanici_id: me.id, kullanici_adi: me.ad_soyad, basarili, hatali: hatalar.length });

  revalidatePath("/personel");
  revalidatePath("/raporlar");
  revalidatePath("/dashboard");
  revalidatePath("/ayarlar/magazalar");
  return { basarili, hatalar };
}
