import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PersonelTablosu from "./PersonelTablosu";

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
  const { data: personelHam, error: personelHata } = await supabase
    .from("personel")
    .select(
      "id, ad_soyad, guncel_unvan, kadro_kategorisi, durum, kidem_ay, performans_ortalama_hgo, guncel_magaza_id, magazalar(magaza_adi, bolgeler(ad))"
    )
    .order("ad_soyad");

  if (personelHata) {
    return <div className="text-xs text-danger">Hata: {personelHata.message}</div>;
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
