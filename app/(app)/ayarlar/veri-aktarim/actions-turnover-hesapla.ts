"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// SGK "İşten Ayrılma Açıklaması" sınıflandırması — İş Kanunu'ndaki
// ilgili maddelere göre istifa (işçi taraflı, gönüllü) / fesih (işveren
// taraflı, zorunlu) / nötr (turnover hesabına hiç dahil edilmeyen,
// yasal-doğal sona erişler) olarak üçe ayrılır. Kararlaştırılan liste.
// ============================================================
const ISTIFA_ACIKLAMALARI = new Set([
  "Belirsiz süreli iş sözleşmesinin işçi tarafından feshi",
  "İşçi tarafından sağlık nedeniyle fesih",
  "Deneme süreli iş sözleşmesinin işçi tarafından feshi",
  "Kadın işçinin evlenmesi",
  "Emeklilik (yaşlılık) veya toptan ödeme nedeniyle",
  "Emeklilik için yaş dışında diğer şartların tamamlanması",
  "Malülen emeklilik nedeniyle",
  "Askerlik",
]);

const FESIH_ACIKLAMALARI = new Set([
  "Belirsiz süreli iş sözleşmesinin İşveren tarafından feshi",
  "İşçinin, işverenin güvenini kötüye kullanmak, hırsızlık yapmak, işverenin meslek sırlarını ortaya atmak gibi doğruluk ve bağlılığa uymayan davranışlarda bulunması",
  "İşçinin işverene yahut onun ailesi üyelerinden birine yahut işverenin başka işçisine sataşması, işyerine sarhoş yahut uyuşturucu madde almış olarak gelmesi ya da işyerinde bu maddeleri kullanması",
  "İşçinin işverenden izin almaksızın veya haklı bir sebebe dayanmaksızın ardı ardına iki işgünü veya bir ay içinde iki defa herhangi bir tatil gününden sonraki iş günü, yahut bir ayda üç işgünü işine devam etmemesi",
  "İşçinin işverenin başka bir işçisine cinsel tacizde bulunması",
  "İşveren tarafından sağlık nedeni ile fesih",
  "İşçinin yapmakla ödevli bulunduğu görevleri kendisine hatırlatıldığı halde yapmamakta ısrar etmesi",
  "Deneme süreli iş sözleşmesinin işverence feshi",
  "İşyerinin kapanması",
  "Devamsızlık Nedeni ile Fesih",
  "İşveren tarafından işçinin ahlak ve iyi niyet kurallarına aykırı davranışı nedeni ile fesih",
  "İşveren tarafından zorunlu nedenlerle ve tutukluluk nedeniyle fesih",
  "İşçinin kendi isteği veya savsaması yüzünden işin güvenliğini tehlikeye düşürmesi, işyerinin malı olan veya malı olmayıp da eli altında bulunan makineleri, tesisatı veya başka eşya ve maddeleri otuz günlük ücretinin tutarıyla ödeyemeyecek derecede hasara ve kayba uğratması",
]);
// Nötr (hesaba dahil değil): "Belirli süreli iş sözleşmesinin sona ermesi", "Ölüm"

type Kategori = "ISTIFA" | "FESIH" | "NOTR";
function siniflandir(aciklama: string | null): Kategori {
  if (!aciklama) return "NOTR";
  const temiz = aciklama.trim();
  if (ISTIFA_ACIKLAMALARI.has(temiz)) return "ISTIFA";
  if (FESIH_ACIKLAMALARI.has(temiz)) return "FESIH";
  return "NOTR";
}

export type TurnoverHesaplamaSonucu = {
  basarili: boolean;
  hata?: string;
  guncellenenMagazaSayisi?: number;
  siniflandirilamayanAciklamalar?: string[];
};

// Mağaza başına turnover'ı, Excel importu yerine doğrudan personel
// verisinden hesaplar. Formül (kararlaştırılan):
//   Turnover % = (İlgili kategoride ayrılan sayısı / Ortalama Personel) × 100
//   Ortalama Personel = (Dönem Başı + Şu Anki) / 2
//   Dönem başında hiç personeli yoksa (yeni mağaza) → Ortalama = Şu Anki
// Dönem: içinde bulunulan yılın başından (1 Ocak) bugüne.
export async function turnoverHesaplaVeGuncelle(): Promise<TurnoverHesaplamaSonucu> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { basarili: false, hata: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { basarili: false, hata: "Sadece Yönetim bu işlemi yapabilir." };

  const bugun = new Date();
  const donemBasi = `${bugun.getFullYear()}-01-01`;
  const bugunStr = bugun.toISOString().slice(0, 10);

  const { data: magazalar } = await supabase.from("magazalar").select("id").eq("aktif", true);
  if (!magazalar || magazalar.length === 0) return { basarili: false, hata: "Mağaza bulunamadı." };

  // Dönem başındaki (1 Ocak) ve hâlâ o tarihte açık olan (ya da sonrasında
  // ayrılan) tüm atama kayıtlarını TEK sorguda çekiyoruz — 178 mağaza için
  // ayrı ayrı sorgu atmamak için.
  const { data: atamalar } = await supabase
    .from("personel_atama_gecmisi")
    .select("personel_id, magaza_id, baslama_tarihi, ayrilma_tarihi")
    .lte("baslama_tarihi", bugunStr)
    .or(`ayrilma_tarihi.is.null,ayrilma_tarihi.gte.${donemBasi}`);

  // Şu anki (güncel) aktif personel sayısı, mağaza bazında.
  const { data: suankiPersonel } = await supabase
    .from("personel")
    .select("guncel_magaza_id")
    .eq("durum", "aktif");

  // Bu yıl ayrılanların SGK açıklamalarını almak için personel tablosuna
  // ayrıca bakılıyor (atama geçmişinde açıklama tutulmuyor).
  const ayrilanPersonelIdleri = Array.from(new Set(
    (atamalar ?? []).filter((a: any) => a.ayrilma_tarihi && a.ayrilma_tarihi >= donemBasi && a.ayrilma_tarihi <= bugunStr).map((a: any) => a.personel_id)
  ));
  const { data: ayrilanlarBilgi } = ayrilanPersonelIdleri.length > 0
    ? await supabase.from("personel").select("id, sgk_isten_ayrilma_aciklamasi").in("id", ayrilanPersonelIdleri)
    : { data: [] as any[] };
  const aciklamaMap: Record<string, string | null> = {};
  (ayrilanlarBilgi ?? []).forEach((p: any) => { aciklamaMap[p.id] = p.sgk_isten_ayrilma_aciklamasi; });

  const suankiSayacMap: Record<string, number> = {};
  (suankiPersonel ?? []).forEach((p: any) => {
    if (p.guncel_magaza_id) suankiSayacMap[p.guncel_magaza_id] = (suankiSayacMap[p.guncel_magaza_id] ?? 0) + 1;
  });

  const siniflandirilamayanlar = new Set<string>();
  const guncellemeler: { id: string; istifa_turnover: number; fesih_turnover: number; toplam_turnover: number }[] = [];

  for (const m of magazalar) {
    const buMagazaAtamalari = (atamalar ?? []).filter((a: any) => a.magaza_id === m.id);

    const donemBasiSayisi = buMagazaAtamalari.filter((a: any) =>
      a.baslama_tarihi <= donemBasi && (!a.ayrilma_tarihi || a.ayrilma_tarihi >= donemBasi)
    ).length;
    const suankiSayisi = suankiSayacMap[m.id] ?? 0;
    const ortalama = donemBasiSayisi > 0 ? (donemBasiSayisi + suankiSayisi) / 2 : suankiSayisi;

    let istifaSayisi = 0;
    let fesihSayisi = 0;
    for (const a of buMagazaAtamalari) {
      if (!a.ayrilma_tarihi || a.ayrilma_tarihi < donemBasi || a.ayrilma_tarihi > bugunStr) continue;
      const aciklama = aciklamaMap[a.personel_id] ?? null;
      const kategori = siniflandir(aciklama);
      if (kategori === "ISTIFA") istifaSayisi++;
      else if (kategori === "FESIH") fesihSayisi++;
      else if (aciklama && aciklama.trim() !== "Belirli süreli iş sözleşmesinin sona ermesi" && aciklama.trim() !== "Ölüm") {
        siniflandirilamayanlar.add(aciklama);
      }
    }

    const istifaTurnover = ortalama > 0 ? Math.round((istifaSayisi / ortalama) * 10000) / 100 : 0;
    const fesihTurnover = ortalama > 0 ? Math.round((fesihSayisi / ortalama) * 10000) / 100 : 0;
    guncellemeler.push({
      id: m.id,
      istifa_turnover: istifaTurnover,
      fesih_turnover: fesihTurnover,
      toplam_turnover: Math.round((istifaTurnover + fesihTurnover) * 100) / 100,
    });
  }

  const PARCA_BOYUTU = 300;
  for (let i = 0; i < guncellemeler.length; i += PARCA_BOYUTU) {
    const parca = guncellemeler.slice(i, i + PARCA_BOYUTU);
    const { error } = await supabase.rpc("magazalar_turnover_guncelle", { p_guncellemeler: parca });
    if (error) return { basarili: false, hata: "Güncelleme hatası: " + error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/norm");
  revalidatePath("/ayarlar/magazalar");

  return {
    basarili: true,
    guncellenenMagazaSayisi: guncellemeler.length,
    siniflandirilamayanAciklamalar: siniflandirilamayanlar.size > 0 ? Array.from(siniflandirilamayanlar) : undefined,
  };
}
