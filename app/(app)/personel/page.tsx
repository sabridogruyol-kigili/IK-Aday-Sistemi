import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PersonelTablosu from "./PersonelTablosu";
import { BELGE_LISTESI, belgeGorunurMu } from "@/lib/evrakSabitleri";

// Supabase tek sorguda en fazla 1000 satır döndürür — atama geçmişi bunu kolayca
// aşabileceği için sayfalayarak (1000'erlik parçalar hâlinde) çekiyoruz.
async function tumSatirlariGetir<T>(sorguOlustur: (bas: number, bitis: number) => any): Promise<T[]> {
  const PARCA = 1000;
  let tumSatirlar: T[] = [];
  let sayfa = 0;
  while (true) {
    const bas = sayfa * PARCA;
    const { data, error } = await sorguOlustur(bas, bas + PARCA - 1);
    if (error || !data) break;
    tumSatirlar = tumSatirlar.concat(data as T[]);
    if (data.length < PARCA) break;
    sayfa++;
  }
  return tumSatirlar;
}

// Kıdem, "İlk Başlama Tarihi"ne güvenilmeden, atama geçmişinden hesaplanır:
// aynı personelin ardışık dönemleri arasında 2 aydan FAZLA boşluk varsa (gerçekten
// işten ayrılıp yeniden işe girmiş demektir), kıdem o yeni dönemden itibaren
// SIFIRDAN sayılır. Mağaza içi rotasyon gibi boşluksuz/kısa geçişler kıdemi bozmaz.
function kidemAyHesapla(donemler: { baslama_tarihi: string | null; ayrilma_tarihi: string | null }[]): number | null {
  const gecerliler = donemler
    .filter((d) => d.baslama_tarihi)
    .map((d) => ({
      baslama: new Date(d.baslama_tarihi as string),
      ayrilma: d.ayrilma_tarihi ? new Date(d.ayrilma_tarihi) : null,
    }))
    .sort((a, b) => a.baslama.getTime() - b.baslama.getTime());

  if (gecerliler.length === 0) return null;

  let donemBaslangic = gecerliler[0].baslama;
  for (let i = 1; i < gecerliler.length; i++) {
    const oncekiBitis = gecerliler[i - 1].ayrilma;
    const buBaslangic = gecerliler[i].baslama;
    if (oncekiBitis) {
      const bosluk_gun = (buBaslangic.getTime() - oncekiBitis.getTime()) / (1000 * 60 * 60 * 24);
      const bosluk_ay = bosluk_gun / 30.44;
      if (bosluk_ay > 2) {
        donemBaslangic = buBaslangic;
      }
    }
  }

  const simdi = new Date();
  const ayFarki = (simdi.getFullYear() - donemBaslangic.getFullYear()) * 12 + (simdi.getMonth() - donemBaslangic.getMonth());
  return Math.max(ayFarki, 0);
}

export default async function PersonelPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS (personel_select) zaten bölge bazlı kısıtlıyor — ek filtre gerekmez.
  // Kapalı (pasif) mağazadaki personel hiç gösterilmez — sistem genelinde pasif
  // mağazalar sadece Dashboard'daki "Kapalı" filtresi gibi özel bir seçenekle
  // görülebilir, başka hiçbir listede varsayılan olarak çıkmaz.
  const { data: personelHam, error: personelHata } = await supabase
    .from("personel")
    .select(
      "id, ad_soyad, guncel_unvan, kadro_kategorisi, durum, kidem_ay, performans_ortalama_hgo, guncel_magaza_id, tc_kimlik_no, evrak_iptal_nedeni, magazalar!inner(magaza_adi, aktif, bolgeler(ad))"
    )
    .eq("magazalar.aktif", true)
    .not("tc_kimlik_no", "like", "PLASIYER-%")
    .order("ad_soyad");

  if (personelHata) {
    return <div className="text-xs text-danger">Hata: {personelHata.message}</div>;
  }

  // Evrak Portalı üzerinden işe alınmış (yani gerçekten bir evrak token'ı
  // oluşmuş) ama zorunlu belgeleri henüz tam onaylanmamış kişiler için özel
  // bir rozet gösterilecek — Excel'den yıllar önce içe aktarılmış eski
  // personel bu kontrole hiç girmez (onların hiç token'ı yok).
  const { data: tokenliPersonelIdleri } = await supabase.from("evrak_erisim_tokenlari").select("personel_id");
  const tokenluIdSeti = new Set((tokenliPersonelIdleri ?? []).map((t: any) => t.personel_id));
  const evrakKontrolEdilecekler = (personelHam ?? []).filter((p: any) => tokenluIdSeti.has(p.id) && !p.evrak_iptal_nedeni);

  const evrakEtiketMap: Record<string, string> = {};
  if (evrakKontrolEdilecekler.length > 0) {
    const idListesi = evrakKontrolEdilecekler.map((p: any) => p.id);
    const [{ data: bilgilerListesi }, { data: belgelerListesi }] = await Promise.all([
      supabase.from("personel_evrak_bilgileri").select("personel_id, cinsiyet").in("personel_id", idListesi),
      supabase.from("personel_evrak_belgeleri").select("personel_id, belge_tipi, durum").in("personel_id", idListesi),
    ]);
    for (const p of evrakKontrolEdilecekler) {
      const cinsiyet = (bilgilerListesi ?? []).find((b: any) => b.personel_id === p.id)?.cinsiyet ?? null;
      const kendiBelgeleri = (belgelerListesi ?? []).filter((b: any) => b.personel_id === p.id);
      const gerekliBelgeler = BELGE_LISTESI.filter((b) => !b.istegeBagli && belgeGorunurMu(b, cinsiyet));
      const onaylanan = gerekliBelgeler.filter((b) => kendiBelgeleri.find((k: any) => k.belge_tipi === b.id)?.durum === "ONAYLANDI").length;
      if (gerekliBelgeler.length > 0 && onaylanan < gerekliBelgeler.length) {
        evrakEtiketMap[p.id] = `Evrak Bekleniyor (${onaylanan}/${gerekliBelgeler.length})`;
      }
    }
  }

  // Not: personel_id'leri .in() filtresine tek seferde vermek (binlerce UUID),
  // sorgunun istek boyutunu aşıp sessizce boş/eksik sonuç dönmesine yol açabiliyordu.
  // Bunun yerine tüm atama geçmişi tablosu, kendi sayfalama mekanizmasıyla çekilir.
  const atamaGecmisi = await tumSatirlariGetir<any>((bas, bitis) =>
    supabase
      .from("personel_atama_gecmisi")
      .select("personel_id, baslama_tarihi, ayrilma_tarihi")
      .range(bas, bitis)
  );

  const atamaMap: Record<string, { baslama_tarihi: string | null; ayrilma_tarihi: string | null }[]> = {};
  atamaGecmisi.forEach((a: any) => {
    if (!atamaMap[a.personel_id]) atamaMap[a.personel_id] = [];
    atamaMap[a.personel_id].push({ baslama_tarihi: a.baslama_tarihi, ayrilma_tarihi: a.ayrilma_tarihi });
  });

  const satirlar = (personelHam ?? []).map((p: any) => {
    const kidemAy = kidemAyHesapla(atamaMap[p.id] ?? []);
    return {
      id: p.id,
      ad_soyad: p.ad_soyad,
      guncel_unvan: p.guncel_unvan ?? "",
      kadro_kategorisi: p.kadro_kategorisi ?? "",
      durum: p.durum,
      kidem_ay: kidemAy,
      kidem_yil: kidemAy != null ? Math.floor(kidemAy / 12) : null,
      performans_ortalama_hgo: p.performans_ortalama_hgo,
      magaza_adi: p.magazalar?.magaza_adi ?? "",
      bolge_adi: p.magazalar?.bolgeler?.ad ?? "",
      evrak_etiket: evrakEtiketMap[p.id] ?? null,
    };
  });

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Personel Listesi</div>
        <div className="text-xs text-gray-400 mt-0.5">Yetkiniz dahilindeki tüm personel</div>
      </div>
      <PersonelTablosu satirlar={satirlar} />
    </div>
  );
}
