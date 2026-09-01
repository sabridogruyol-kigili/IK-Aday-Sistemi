"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

function excelTarih(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

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

function parcala<T>(dizi: T[], boyut: number): T[][] {
  const parcalar: T[][] = [];
  for (let i = 0; i < dizi.length; i += boyut) parcalar.push(dizi.slice(i, i + boyut));
  return parcalar;
}

export async function iceAktarPersonel(rowsHam: any[]): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: 0, hatalar: [], yetkiHatasi: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: 0, hatalar: [], yetkiHatasi: "Sadece Yönetim veri içe aktarabilir." };

  const { data: unvanlarHam } = await supabase.from("unvan_kadro_kategorisi").select("unvan, kategori");
  const unvanMap: Record<string, string> = {};
  (unvanlarHam ?? []).forEach((u: any) => { unvanMap[turkceBuyut(u.unvan)] = u.kategori; });

  const { data: magazalarHam } = await supabase.from("magazalar").select("id, magaza_kodu");
  const magazaMap: Record<string, string> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaMap[m.magaza_kodu] = m.id; });

  const hatalar: SatirHata[] = [];

  type GecerliSatir = {
    satirNo: number;
    tc_kimlik_no: string;
    personel_kodu: string | null;
    ad_soyad: string;
    dogum_tarihi: string | null;
    cinsiyet: string | null;
    guncel_magaza_id: string;
    guncel_unvan: string;
    kadro_kategorisi: string;
    kidem_baslangic_tarihi: string | null;
  };
  const gecerliler: GecerliSatir[] = [];
  const tcGorulen = new Set<string>();

  for (let i = 0; i < rowsHam.length; i++) {
    const satirNo = i + 2;
    const r = satirNormallestir(rowsHam[i]);

    const ayrilmaTarihiParsed = excelTarih(r["İşten Ayrılma Tarihi"]);
    // Excel'in ünlü "1900 sahte artık yılı" hatası yüzünden serial 1 ("1900-01-01" placeholder'ı
    // temsil etmesi gereken değer), standart dönüşüm formülüyle "1899-12-31" çıkıyor — birebir
    // string karşılaştırması bu yüzden hep başarısız oluyordu. Bunun yerine yıl bazlı, 1901 ve
    // öncesini "henüz ayrılmamış" sayan daha sağlam bir kontrol kullanıyoruz (gerçek ayrılma
    // tarihleri her zaman 1901'den çok sonra olacaktır).
    const ayrilmaYili = ayrilmaTarihiParsed ? parseInt(ayrilmaTarihiParsed.slice(0, 4), 10) : null;
    const gercektenAyrilmisMi = ayrilmaYili !== null && ayrilmaYili > 1901;
    if (gercektenAyrilmisMi) continue;

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
      hatalar.push({ satir: satirNo, hata: `Departman Kodu (${departmanKodu}) sistemde tanımlı bir mağaza koduna karşılık gelmiyor.` });
      continue;
    }
    const kategori = unvanMap[turkceBuyut(unvanHam)];
    if (!kategori) {
      hatalar.push({ satir: satirNo, hata: `İş Ünvanı Açıklaması (${unvanHam}) tanınan ünvan listesinde yok.` });
      continue;
    }
    if (tcGorulen.has(tcKimlikNo)) {
      hatalar.push({ satir: satirNo, hata: `TC Kimlik No (${tcKimlikNo}) dosyada birden fazla kez geçiyor, bu satır atlandı.` });
      continue;
    }
    tcGorulen.add(tcKimlikNo);

    gecerliler.push({
      satirNo, tc_kimlik_no: tcKimlikNo, personel_kodu: personelKodu || null, ad_soyad: adSoyad,
      dogum_tarihi: dogumTarihi, cinsiyet, guncel_magaza_id: magazaId, guncel_unvan: unvanHam,
      kadro_kategorisi: kategori, kidem_baslangic_tarihi: iseBaslamaTarihi,
    });
  }

  if (gecerliler.length === 0) {
    return { basarili: 0, hatalar };
  }

  const PARCA_BOYUTU = 500;
  const tcToId = new Map<string, string>();

  // Performans importunun otomatik oluşturduğu "PLASIYER-<sicil>" yer tutucu kayıtlarını bul.
  // Bu Personel importunda aynı personel_kodu ile karşılaşırsak, YENİ kayıt açmak yerine
  // o kaydı gerçek bilgilerle güncelleyip id'sini koruyacağız (performans geçmişi kopmasın diye).
  const { data: placeholderlarHam } = await supabase
    .from("personel")
    .select("id, personel_kodu")
    .like("tc_kimlik_no", "PLASIYER-%");
  const placeholderMap: Record<string, string> = {};
  (placeholderlarHam ?? []).forEach((p: any) => { if (p.personel_kodu) placeholderMap[p.personel_kodu] = p.id; });

  const birlestirilecekler = gecerliler.filter((p) => p.personel_kodu && placeholderMap[p.personel_kodu]);
  const normalSatirlar = gecerliler.filter((p) => !(p.personel_kodu && placeholderMap[p.personel_kodu]));

  if (birlestirilecekler.length > 0) {
    const guncellemeler = birlestirilecekler.map((p) => ({
      id: placeholderMap[p.personel_kodu!],
      tc_kimlik_no: p.tc_kimlik_no,
      ad_soyad: p.ad_soyad,
      dogum_tarihi: p.dogum_tarihi ?? "",
      cinsiyet: p.cinsiyet,
      guncel_magaza_id: p.guncel_magaza_id,
      guncel_unvan: p.guncel_unvan,
      kadro_kategorisi: p.kadro_kategorisi,
      kidem_baslangic_tarihi: p.kidem_baslangic_tarihi ?? "",
    }));
    for (const parca of parcala(guncellemeler, PARCA_BOYUTU)) {
      const { error } = await supabase.rpc("personel_placeholder_birlestir", { p_guncellemeler: parca });
      if (error) {
        birlestirilecekler.forEach((p) => hatalar.push({ satir: p.satirNo, hata: "Yer tutucu kayıtla birleştirilemedi: " + error.message }));
      } else {
        parca.forEach((g) => tcToId.set(g.tc_kimlik_no, g.id));
      }
    }
  }

  for (const parca of parcala(normalSatirlar, PARCA_BOYUTU)) {
    const { data: eklenenler, error: upsertHata } = await supabase
      .from("personel")
      .upsert(
        parca.map((p) => ({
          tc_kimlik_no: p.tc_kimlik_no,
          personel_kodu: p.personel_kodu,
          ad_soyad: p.ad_soyad,
          dogum_tarihi: p.dogum_tarihi,
          cinsiyet: p.cinsiyet,
          guncel_magaza_id: p.guncel_magaza_id,
          guncel_unvan: p.guncel_unvan,
          durum: "aktif",
          kadro_kategorisi: p.kadro_kategorisi,
          kidem_baslangic_tarihi: p.kidem_baslangic_tarihi,
        })),
        { onConflict: "tc_kimlik_no" }
      )
      .select("id, tc_kimlik_no");

    if (upsertHata) {
      parca.forEach((p) => hatalar.push({ satir: p.satirNo, hata: "Personel kaydedilemedi: " + upsertHata.message }));
      continue;
    }
    (eklenenler ?? []).forEach((e: any) => tcToId.set(e.tc_kimlik_no, e.id));
  }

  const basarili = tcToId.size;

  const ilgiliPersonelIdleri = Array.from(tcToId.values());
  const mevcutAtamaAnahtarlari = new Set<string>();

  for (const parca of parcala(ilgiliPersonelIdleri, PARCA_BOYUTU)) {
    const { data: mevcutlar } = await supabase
      .from("personel_atama_gecmisi")
      .select("personel_id, magaza_id, baslama_tarihi")
      .in("personel_id", parca);
    (mevcutlar ?? []).forEach((m: any) => {
      mevcutAtamaAnahtarlari.add(`${m.personel_id}|${m.magaza_id}|${m.baslama_tarihi}`);
    });
  }

  const yeniAtamalar = gecerliler
    .filter((p) => p.kidem_baslangic_tarihi && tcToId.has(p.tc_kimlik_no))
    .map((p) => ({
      personel_id: tcToId.get(p.tc_kimlik_no)!,
      magaza_id: p.guncel_magaza_id,
      unvan: p.guncel_unvan,
      baslama_tarihi: p.kidem_baslangic_tarihi,
      kaynak: "import",
    }))
    .filter((a) => !mevcutAtamaAnahtarlari.has(`${a.personel_id}|${a.magaza_id}|${a.baslama_tarihi}`));

  for (const parca of parcala(yeniAtamalar, PARCA_BOYUTU)) {
    await supabase.from("personel_atama_gecmisi").insert(parca);
  }

  revalidatePath("/personel");
  revalidatePath("/norm");
  revalidatePath("/dashboard");
  return { basarili, hatalar };
}
