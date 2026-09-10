import { createClient } from "@/lib/supabase/server";
import MaasTablosu from "./MaasTablosu";
import TavanFormu from "./TavanFormu";

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
  }import { createClient } from "@/lib/supabase/server";
import UnvanMaasTablosu from "./UnvanMaasTablosu";
import TavanFormu from "./TavanFormu";

export default async function MaasBilgileriPage() {
  const supabase = createClient();

  const [{ data: ayar }, { data: unvanlarHam }, { data: maaslar }] = await Promise.all([
    supabase.from("sistem_ayarlari").select("kidem_tazminati_tavani").eq("id", 1).single(),
    supabase.from("unvan_kadro_kategorisi").select("unvan, kategori").eq("kategori", "ANA_KADRO").order("unvan"),
    supabase.from("unvan_maas").select("unvan, brut_maas"),
  ]);

  const maasMap: Record<string, number | null> = {};
  (maaslar ?? []).forEach((m: any) => { maasMap[m.unvan] = m.brut_maas; });

  const unvanlar = (unvanlarHam ?? []).map((u: any) => ({
    unvan: u.unvan,
    kategori: u.kategori,
    brut_maas: maasMap[u.unvan] ?? null,
  }));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-sm font-semibold text-navy-3 mb-1">Kıdem Tazminatı Tavanı</div>
        <div className="text-xs text-gray-400 mb-3">
          Hazine ve Maliye Bakanlığı tarafından her yıl Ocak ve Temmuz aylarında güncellenir — güncel tutarı buradan siz girin.
        </div>
        <TavanFormu mevcutTavan={ayar?.kidem_tazminati_tavani ?? 0} />
      </div>

      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-sm font-semibold text-navy-3 mb-1">Ünvan Bazlı Maaş Bilgileri</div>
        <div className="text-xs text-gray-400 mb-3">
          Her ünvan için <strong>tek bir temel brüt maaş</strong> (prim/ek ücret hariç) girilir — o ünvandaki tüm personele aynı tutar uygulanır. İşten Çıkarma formundaki kıdem tazminatı tahmini buradan hesaplanır.
        </div>
        <UnvanMaasTablosu unvanlar={unvanlar} />
      </div>
    </div>
  );
}
  return tumSatirlar;
}

export default async function MaasBilgileriPage() {
  const supabase = createClient();

  const [{ data: ayar }, personelListesi] = await Promise.all([
    supabase.from("sistem_ayarlari").select("kidem_tazminati_tavani").eq("id", 1).single(),
    tumSatirlariGetir<any>((bas, bitis) =>
      supabase
        .from("personel")
        .select("id, ad_soyad, guncel_unvan, kidem_ay, brut_maas, magazalar!guncel_magaza_id(magaza_adi)")
        .eq("durum", "aktif")
        .not("tc_kimlik_no", "like", "PLASIYER-%")
        .order("ad_soyad")
        .range(bas, bitis)
    ),
  ]);

  const personel = personelListesi.map((p: any) => ({
    id: p.id,
    ad_soyad: p.ad_soyad,
    guncel_unvan: p.guncel_unvan,
    magaza_adi: p.magazalar?.magaza_adi ?? "—",
    kidem_ay: p.kidem_ay,
    brut_maas: p.brut_maas,
  }));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-sm font-semibold text-navy-3 mb-1">Kıdem Tazminatı Tavanı</div>
        <div className="text-xs text-gray-400 mb-3">
          Hazine ve Maliye Bakanlığı tarafından her yıl Ocak ve Temmuz aylarında güncellenir — güncel tutarı buradan siz girin.
        </div>
        <TavanFormu mevcutTavan={ayar?.kidem_tazminati_tavani ?? 0} />
      </div>

      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-sm font-semibold text-navy-3 mb-1">Personel Maaş Bilgileri</div>
        <div className="text-xs text-gray-400 mb-3">
          Girilen tutar <strong>prim ve ek ücretler hariç, sade brüt maaştır</strong> — İşten Çıkarma formundaki kıdem tazminatı tahmini bu değer üzerinden hesaplanır.
        </div>
        <MaasTablosu personel={personel} />
      </div>
    </div>
  );
}
