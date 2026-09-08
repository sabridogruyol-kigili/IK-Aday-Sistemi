import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TalepForm from "./TalepForm";
import CikarmaForm from "./CikarmaForm";
import NormTalebiForm from "./NormTalebiForm";

// Supabase tek sorguda en fazla 1000 satır döndürür — personel sayımız bunu
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

export default async function YeniTalepPage({ searchParams }: { searchParams: { tur?: string; magaza_id?: string; kategori?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (me?.rol === "MAGAZALAR_DIREKTORLUGU") redirect("/talepler");

  const tur = ["ise_alim", "cikarma", "norm_degisiklik"].includes(searchParams.tur ?? "") ? searchParams.tur! : "ise_alim";

  const { data: magazalar } = await supabase
    .from("magazalar").select("id, magaza_adi, magaza_kodu").eq("aktif", true).order("magaza_adi");

  const { data: bolgeler } = await supabase
    .from("bolgeler").select("id, ad").order("ad");

  const { data: magazalarNormHam } = await supabase
    .from("magazalar")
    .select("id, magaza_adi, magaza_kodu, bolgeler(ad), norm(ana_kadro_norm, donemsel_norm, part_time_norm)")
    .eq("aktif", true)
    .order("magaza_adi");
  const magazalarNorm = (magazalarNormHam ?? []).map((m: any) => {
    const n = Array.isArray(m.norm) ? m.norm[0] : m.norm;
    return {
      id: m.id,
      magaza_adi: m.magaza_adi,
      magaza_kodu: m.magaza_kodu,
      bolge_adi: m.bolgeler?.ad ?? "",
      ana_kadro_norm: n?.ana_kadro_norm ?? 0,
      donemsel_norm: n?.donemsel_norm ?? 0,
      part_time_norm: n?.part_time_norm ?? 0,
    };
  });

  const { data: pozisyonlarHam } = await supabase
    .from("unvan_kadro_kategorisi")
    .select("unvan, kategori")
    .in("kategori", ["ANA_KADRO", "DONEMSEL", "PART_TIME"])
    .order("kategori")
    .order("unvan");
  const pozisyonlar = pozisyonlarHam ?? [];

  const personelHam = await tumSatirlariGetir<any>((bas, bitis) =>
    supabase
      .from("personel")
      .select("id, ad_soyad, guncel_unvan, guncel_magaza_id, performans_ortalama_hgo, performans_80_alti_sayisi, performans_80_100_arasi_sayisi, performans_100_ustu_sayisi, magazalar!inner(magaza_adi, bolge_id, aktif, bolgeler(ad))")
      .eq("durum", "aktif")
      .eq("magazalar.aktif", true)
      .order("ad_soyad")
      .range(bas, bitis)
  );

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
    { key: "norm_degisiklik", label: "Norm Değişikliği" },
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
      {tur === "ise_alim" && <TalepForm magazalar={magazalar ?? []} pozisyonlar={pozisyonlar} bolgeler={bolgeler ?? []} />}
      {tur === "cikarma" && <CikarmaForm personelListesi={personelListesi} pozisyonlar={pozisyonlar} />}
      {tur === "norm_degisiklik" && (
        <NormTalebiForm
          magazalar={magazalarNorm}
          initialMagazaId={searchParams.magaza_id ?? ""}
          initialKategori={searchParams.kategori ?? ""}
        />
      )}
    </div>
  );
}
