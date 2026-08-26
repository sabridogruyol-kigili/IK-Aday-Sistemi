import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TalepForm from "./TalepForm";
import CikarmaForm from "./CikarmaForm";

export default async function YeniTalepPage({ searchParams }: { searchParams: { tur?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tur = ["ise_alim", "cikarma"].includes(searchParams.tur ?? "") ? searchParams.tur! : "ise_alim";

  const { data: magazalar } = await supabase
    .from("magazalar").select("id, magaza_adi, magaza_kodu").eq("aktif", true).order("magaza_adi");

  const { data: pozisyonlarHam } = await supabase
    .from("unvan_kadro_kategorisi")
    .select("unvan, kategori")
    .in("kategori", ["ANA_KADRO", "DONEMSEL", "PART_TIME"])
    .order("kategori")
    .order("unvan");
  const pozisyonlar = pozisyonlarHam ?? [];

  const { data: personelHam } = await supabase
    .from("personel")
    .select("id, ad_soyad, guncel_unvan, guncel_magaza_id, performans_ortalama_hgo, performans_80_alti_sayisi, performans_80_100_arasi_sayisi, performans_100_ustu_sayisi, magazalar(magaza_adi, bolge_id, bolgeler(ad))")
    .eq("durum", "aktif")
    .order("ad_soyad");

  const personelListesi = (personelHam ?? []).map((p: any) => ({
    id: p.id,
    ad_soyad: p.ad_soyad,
    guncel_unvan: p.guncel_unvan,
    magaza_adi: p.magazalar?.magaza_adi ?? "",
    bolge_adi: p.magazalar?.bolgeler?.ad ?? "",
    performans_ortalama_hgo: p.performans_ortalama_hgo,
    performans_80_alti_sayisi: p.performans_80_alti_sayisi,
    performans_80_100_arasi_sayisi: p.performans_80_100_arasi_sayisi,
    performans_100_ustu_sayisi: p.performans_100_ustu_sayisi,
  }));

  const sekmeler = [
    { key: "ise_alim", label: "İşe Alım" },
    { key: "cikarma", label: "İşten Çıkarma" },
  ];

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Yeni Talep</div>
        <div className="text-xs text-gray-400 mt-0.5">Norm kontrolü anında yapılır</div>
      </div>
      <div className="flex gap-2 mb-4">
        {sekmeler.map((s) => (
          <a key={s.key} href={`/talepler/yeni?tur=${s.key}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${tur === s.key ? "bg-navy text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
            {s.label}
          </a>
        ))}
      </div>
      {tur === "ise_alim" && <TalepForm magazalar={magazalar ?? []} pozisyonlar={pozisyonlar} />}
      {tur === "cikarma" && <CikarmaForm personelListesi={personelListesi} pozisyonlar={pozisyonlar} />}
    </div>
  );
}
