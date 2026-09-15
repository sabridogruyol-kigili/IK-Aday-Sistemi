"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type SatirHata = { satir: number; hata: string };
type Sonuc = { basarili: number; hatalar: SatirHata[]; yetkiHatasi?: string };

// Personel Kodu / Sicil kimi dosyada metin ("008144", baştaki sıfır korunur), kimi
// dosyada Excel'in sayı+özel biçim olarak yazdığı bir değer ("8144", sıfır kaybolur)
// olarak gelebilir. İki farklı dosyadan gelen aynı kişi eşleşsin diye baştaki
// sıfırlar her zaman kaldırılır (tek başına "0" ise dokunulmaz).
function sicilNormalize(kod: string): string {
  const s = String(kod ?? "").trim();
  const sifirsiz = s.replace(/^0+(?=\d)/, "");
  return sifirsiz || s;
}

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

  const { data: me } = await supabase.from("kullanicilar").select("id, ad_soyad, rol").eq("email", user.email).single();
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
    onceki_is_yeri: string | null;
    ihtarname: string | null;
    uyari_yazisi: string | null;
    tutanak: string | null;
    savunma: string | null;
    kan_grubu_kodu: string | null;
    uyruk: string | null;
    ozel_mobil: string | null;
    evli: string | null;
    notlar: string | null;
  };
  // Ayrılmış (İşten Ayrılma Tarihi dolu) kişiler için de AYNI alanlar +
  // ayrılma tarihi/açıklaması — daha önce sistemde hiç "aktif" olarak
  // görünmemiş (yani doğrudan geçmişte ayrılmış olarak Excel'e giren)
  // kişiler için de tam bir personel kaydı ve kapalı bir atama geçmişi
  // oluşturulabilsin diye, artık bu satırlar da diğerleri gibi tam
  // ayrıştırılıyor (önceden sadece TC+tarih notu alınıp atlanıyordu).
  type AyrilanSatir = GecerliSatir & { ayrilma_tarihi: string; sgk_aciklama: string | null };

  const gecerliler: GecerliSatir[] = [];
  const ayrilanlar: AyrilanSatir[] = [];
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

    const tcKimlikNo = String(r["TC Kimlik No"] ?? "").trim();
    const personelKodu = sicilNormalize(String(r["Personel Kodu"] ?? ""));
    const adSoyad = String(r["Adı-Soyadı"] ?? "").trim();
    const departmanKodu = String(r["Departman Kodu"] ?? "").trim();
    const unvanHam = String(r["İş Ünvanı Açıklaması"] ?? "").trim();
    const dogumTarihi = excelTarih(r["Doğum Tarihi"]);
    const cinsiyet = String(r["Cinsiyet Açıklaması"] ?? "").trim() || null;
    // "İşyeri Başlama Tarihi" boşsa "İlk Başlama Tarihi" yedek olarak denenir —
    // tek başına kıdem hesabı için güvenilmez kabul edilse de, hiç atama geçmişi
    // kaydı oluşmamasından (dolayısıyla kıdemin tamamen boş kalmasından) iyidir.
    const iseBaslamaTarihi = excelTarih(r["İşyeri Başlama Tarihi"]) ?? excelTarih(r["İlk Başlama Tarihi"]);
    const onceki_is_yeri = String(r["Önceki İş Yeri"] ?? "").trim() || null;
    const ihtarname = String(r["İHTARNAME Açıklama"] ?? "").trim() || null;
    const uyari_yazisi = String(r["UYARI YAZISI Açıklama"] ?? "").trim() || null;
    const tutanak = String(r["Tutanak Açıklama"] ?? "").trim() || null;
    const savunma = String(r["Savunma Açıklama"] ?? "").trim() || null;
    const kan_grubu_kodu = String(r["Kan Grubu Kodu"] ?? "").trim() || null;
    const uyruk = String(r["Uyruk"] ?? "").trim() || null;
    const ozel_mobil = String(r["ÖzelMobil"] ?? "").trim() || null;
    const evli = String(r["Evli"] ?? "").trim() || null;
    const notlar = String(r["PlainText"] ?? "").trim() || null;

    if (!tcKimlikNo || !adSoyad || !departmanKodu || !unvanHam) {
      hatalar.push({ satir: satirNo, hata: "TC Kimlik No, Adı-Soyadı, Departman Kodu veya İş Ünvanı Açıklaması eksik." });
      continue;
    }
    // Bazı dosyalarda özet/junk satırlar isim yerine tek karakterlik bir
    // yer tutucu ("-", "–", ".") içerebiliyor — bunlar gerçek bir isim
    // sayılmaz, satır atlanır (Çalışan Performans importundaki aynı mantık).
    if (/^[-–—.]+$/.test(adSoyad)) {
      hatalar.push({ satir: satirNo, hata: `TC ${tcKimlikNo}: isim geçersiz ("${adSoyad}") — özet/junk satır olarak atlandı.` });
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

    const ortakAlanlar = {
      satirNo, tc_kimlik_no: tcKimlikNo, personel_kodu: personelKodu || null, ad_soyad: adSoyad,
      dogum_tarihi: dogumTarihi, cinsiyet, guncel_magaza_id: magazaId, guncel_unvan: unvanHam,
      kadro_kategorisi: kategori, kidem_baslangic_tarihi: iseBaslamaTarihi,
      onceki_is_yeri, ihtarname, uyari_yazisi, tutanak, savunma, kan_grubu_kodu, uyruk, ozel_mobil, evli, notlar,
    };

    if (gercektenAyrilmisMi) {
      ayrilanlar.push({
        ...ortakAlanlar,
        ayrilma_tarihi: ayrilmaTarihiParsed as string,
        sgk_aciklama: r["İşten Ayrılma Açıklaması"] ? String(r["İşten Ayrılma Açıklaması"]).trim() : null,
      });
    } else {
      gecerliler.push(ortakAlanlar);
    }
  }

  if (gecerliler.length === 0 && ayrilanlar.length === 0) {
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

  // Bir yer tutucunun TC'si, o TC'yle ZATEN var olan gerçek bir kayda
  // (örn. önceki bir importtan kalma) çakışabilir — bu durumda TC'yi
  // güncellemek "duplicate key" hatası verir. Önce bunu tespit edip, bu
  // satırları AYRI bir "gerçek ikizi var" grubuna ayırıyoruz.
  const hedefTcListesi = birlestirilecekler.map((p) => p.tc_kimlik_no);
  const { data: gercekIkizlerHam } = hedefTcListesi.length > 0
    ? await supabase.from("personel").select("id, tc_kimlik_no").in("tc_kimlik_no", hedefTcListesi).not("tc_kimlik_no", "like", "PLASIYER-%")
    : { data: [] as any[] };
  const gercekIkizMap: Record<string, string> = {};
  (gercekIkizlerHam ?? []).forEach((g: any) => { gercekIkizMap[g.tc_kimlik_no] = g.id; });

  const ikiziOlanlar = birlestirilecekler.filter((p) => gercekIkizMap[p.tc_kimlik_no]);
  const normalBirlesecekler = birlestirilecekler.filter((p) => !gercekIkizMap[p.tc_kimlik_no]);

  // "Gerçek ikizi var" durumu: yer tutucuya bağlı performans kayıtlarını
  // gerçek kayda taşı (o ay zaten varsa gerçek kayıt esas alınır), yer
  // tutucuyu sil, ve bu satırı normal güncelleme akışına (gerçek kaydın
  // id'siyle) dahil et.
  for (const p of ikiziOlanlar) {
    const yertutucuId = placeholderMap[p.personel_kodu!];
    const gercekId = gercekIkizMap[p.tc_kimlik_no];

    const { data: yertutucuPerformans } = await supabase.from("performans_kisi_aylik").select("yil, ay").eq("personel_id", yertutucuId);
    for (const ay of yertutucuPerformans ?? []) {
      const { data: cakisan } = await supabase.from("performans_kisi_aylik").select("id").eq("personel_id", gercekId).eq("yil", ay.yil).eq("ay", ay.ay).maybeSingle();
      if (!cakisan) {
        await supabase.from("performans_kisi_aylik").update({ personel_id: gercekId }).eq("personel_id", yertutucuId).eq("yil", ay.yil).eq("ay", ay.ay);
      }
    }
    await supabase.from("performans_kisi_aylik").delete().eq("personel_id", yertutucuId);
    await supabase.from("personel").delete().eq("id", yertutucuId);
    tcToId.set(p.tc_kimlik_no, gercekId);
  }
  // Gerçek ikizi bulunanlar artık normal upsert akışında (aşağıda) güncel
  // Excel bilgileriyle (ünvan, mağaza vb.) yenilenecek.
  normalSatirlar.push(...ikiziOlanlar);

  if (normalBirlesecekler.length > 0) {
    const guncellemeler = normalBirlesecekler.map((p) => ({
      id: placeholderMap[p.personel_kodu!],
      tc_kimlik_no: p.tc_kimlik_no,
      ad_soyad: p.ad_soyad,
      dogum_tarihi: p.dogum_tarihi ?? "",
      cinsiyet: p.cinsiyet,
      guncel_magaza_id: p.guncel_magaza_id,
      guncel_unvan: p.guncel_unvan,
      kadro_kategorisi: p.kadro_kategorisi,
      kidem_baslangic_tarihi: p.kidem_baslangic_tarihi ?? "",
      onceki_is_yeri: p.onceki_is_yeri,
      ihtarname: p.ihtarname,
      uyari_yazisi: p.uyari_yazisi,
      tutanak: p.tutanak,
      savunma: p.savunma,
      kan_grubu_kodu: p.kan_grubu_kodu,
      uyruk: p.uyruk,
      ozel_mobil: p.ozel_mobil,
      evli: p.evli,
      notlar: p.notlar,
    }));
    for (const parca of parcala(guncellemeler, PARCA_BOYUTU)) {
      const { error } = await supabase.rpc("personel_placeholder_birlestir", { p_guncellemeler: parca });
      if (error) {
        normalBirlesecekler.forEach((p) => hatalar.push({ satir: p.satirNo, hata: "Yer tutucu kayıtla birleştirilemedi: " + error.message }));
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
          onceki_is_yeri: p.onceki_is_yeri,
          ihtarname: p.ihtarname,
          uyari_yazisi: p.uyari_yazisi,
          tutanak: p.tutanak,
          savunma: p.savunma,
          kan_grubu_kodu: p.kan_grubu_kodu,
          uyruk: p.uyruk,
          ozel_mobil: p.ozel_mobil,
          evli: p.evli,
          notlar: p.notlar,
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

  // Dosyada gerçek bir "İşten Ayrılma Tarihi" ile görünen kişiler için üç
  // durum olabilir: (1) sistemde hâlâ "aktif" görünüyor → pasife çek,
  // SGK açıklamasını kaydet, açık atama kaydını kapat. (2) zaten pasif ama
  // açıklaması boş (bu alan sonradan eklendiği için) → sadece açıklamayı
  // geriye dönük doldur. (3) sistemde HİÇ kaydı yok (yani hiç aktif olarak
  // görünmeden doğrudan geçmişte ayrılmış olarak dosyaya girmiş) → bu kişi
  // için SIFIRDAN, doğrudan pasif durumda bir personel kaydı VE kapalı bir
  // atama geçmişi kaydı oluştur. Üçüncü durum önceden HİÇ ele alınmıyordu,
  // bu yüzden hiç aktif olmamış geçmiş kişiler tamamen kayboluyordu
  // (Turnover hesabı da bu yüzden eksik çıkıyordu).
  let yeniOlusturulanGecmis = 0;
  if (ayrilanlar.length > 0) {
    const ayrilanTcListesi = ayrilanlar.map((a) => a.tc_kimlik_no);
    const ayrilanMap = new Map(ayrilanlar.map((a) => [a.tc_kimlik_no, a]));

    for (const parca of parcala(ayrilanTcListesi, PARCA_BOYUTU)) {
      const { data: mevcutKisiler } = await supabase
        .from("personel")
        .select("id, tc_kimlik_no, durum, sgk_isten_ayrilma_aciklamasi")
        .in("tc_kimlik_no", parca);
      const mevcutMap = new Map((mevcutKisiler ?? []).map((p: any) => [p.tc_kimlik_no, p]));

      for (const tc of parca) {
        const a = ayrilanMap.get(tc)!;
        const mevcut = mevcutMap.get(tc);

        if (!mevcut) {
          // Durum 3: hiç kaydı yok — sıfırdan pasif bir personel + kapalı
          // atama geçmişi oluştur.
          const { data: yeniKisi, error: eklemeHata } = await supabase
            .from("personel")
            .insert({
              tc_kimlik_no: a.tc_kimlik_no, personel_kodu: a.personel_kodu, ad_soyad: a.ad_soyad,
              dogum_tarihi: a.dogum_tarihi || null, cinsiyet: a.cinsiyet,
              guncel_magaza_id: a.guncel_magaza_id, guncel_unvan: a.guncel_unvan,
              kadro_kategorisi: a.kadro_kategorisi, kidem_baslangic_tarihi: a.kidem_baslangic_tarihi || null,
              onceki_is_yeri: a.onceki_is_yeri, ihtarname: a.ihtarname, uyari_yazisi: a.uyari_yazisi,
              tutanak: a.tutanak, savunma: a.savunma, kan_grubu_kodu: a.kan_grubu_kodu, uyruk: a.uyruk,
              ozel_mobil: a.ozel_mobil, evli: a.evli, notlar: a.notlar,
              durum: "pasif", sgk_isten_ayrilma_aciklamasi: a.sgk_aciklama,
            })
            .select("id")
            .single();
          if (eklemeHata || !yeniKisi) {
            hatalar.push({ satir: a.satirNo, hata: "Geçmiş kayıt oluşturulamadı: " + (eklemeHata?.message ?? "bilinmeyen hata") });
            continue;
          }
          await supabase.from("personel_atama_gecmisi").insert({
            personel_id: yeniKisi.id, magaza_id: a.guncel_magaza_id,
            baslama_tarihi: a.kidem_baslangic_tarihi || a.ayrilma_tarihi, ayrilma_tarihi: a.ayrilma_tarihi,
          });
          yeniOlusturulanGecmis++;
        } else if (mevcut.durum === "aktif") {
          // Durum 1: hâlâ aktif görünüyor — pasife çek, açıklamayı kaydet.
          await supabase.from("personel").update({ durum: "pasif", sgk_isten_ayrilma_aciklamasi: a.sgk_aciklama }).eq("id", mevcut.id);
          await supabase.from("personel_atama_gecmisi").update({ ayrilma_tarihi: a.ayrilma_tarihi }).eq("personel_id", mevcut.id).is("ayrilma_tarihi", null);
        } else if (!mevcut.sgk_isten_ayrilma_aciklamasi && a.sgk_aciklama) {
          // Durum 2: zaten pasif, sadece açıklaması eksik — geriye dönük doldur.
          await supabase.from("personel").update({ sgk_isten_ayrilma_aciklamasi: a.sgk_aciklama }).eq("id", mevcut.id);
        }
      }
    }
  }

  revalidatePath("/personel");
  revalidatePath("/norm");
  revalidatePath("/dashboard");
  revalidatePath("/ayarlar/magazalar");
  return { basarili: basarili + yeniOlusturulanGecmis, hatalar };
}
