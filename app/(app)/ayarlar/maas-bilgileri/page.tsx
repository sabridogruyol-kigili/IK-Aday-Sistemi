import { createClient } from "@/lib/supabase/server";
import UnvanMaasTablosu from "./UnvanMaasTablosu";
import TavanFormu from "./TavanFormu";
import IkIletisimFormu from "./IkIletisimFormu";

export default async function MaasBilgileriPage() {
  const supabase = createClient();

  const [{ data: ayar }, { data: unvanlarHam }, { data: maaslar }] = await Promise.all([
    supabase.from("sistem_ayarlari").select("kidem_tazminati_tavani, ik_website, ik_email, ik_adres, ik_calisma_saatleri").eq("id", 1).single(),
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
        <div className="text-sm font-semibold text-navy-3 mb-1">İK İletişim Bilgileri</div>
        <div className="text-xs text-gray-400 mb-3">
          Adayların gördüğü <strong>Evrak Portalı</strong>'nın alt kısmında gösterilen iletişim bilgileri — buradan güncelleyin.
        </div>
        <IkIletisimFormu
          mevcutWebsite={ayar?.ik_website ?? ""}
          mevcutEmail={ayar?.ik_email ?? ""}
          mevcutAdres={ayar?.ik_adres ?? ""}
          mevcutCalismaSaatleri={ayar?.ik_calisma_saatleri ?? ""}
        />
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
