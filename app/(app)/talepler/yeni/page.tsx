import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TalepForm from "./TalepForm";
import CikarmaForm from "./CikarmaForm";
import RotasyonForm from "./RotasyonForm";

export default async function YeniTalepPage({ searchParams }: { searchParams: { tur?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tur = ["ise_alim", "cikarma", "rotasyon"].includes(searchParams.tur ?? "") ? searchParams.tur! : "ise_alim";

  const { data: magazalar } = await supabase
    .from("magazalar").select("id, magaza_adi, magaza_kodu").eq("aktif", true).order("magaza_adi");

  // İşten Çıkarma: sadece kullanıcının yetkisi dahilindeki (RLS ile sınırlı) personel + bölge/mağaza bilgisiyle zenginleştirilmiş
  const { data: personelHam } = await supabase
    .from("personel")
    .select("id, ad_soyad, guncel_unvan, guncel_magaza_id, magazalar(magaza_adi, bolge_id, bolgeler(ad))")
    .eq("durum", "aktif")
    .order("ad_soyad");

  const personelListesi = (personelHam ?? []).map((p: any) => ({
    id: p.id,
    ad_soyad: p.ad_soyad,
    guncel_unvan: p.guncel_unvan,
    magaza_adi: p.magazalar?.magaza_adi ?? "",
    bolge_adi: p.magazalar?.bolgeler?.ad ?? "",
  }));

  // Rotasyon: bölge sınırlaması olmadan TÜM mağaza ve personeli görmesi gerekiyor
  const { data: tumMagazalar } = tur === "rotasyon"
    ? await supabase.rpc("tum_magazalar_listesi")
    : { data: [] };
  const { data: tumPersonel } = tur === "rotasyon"
    ? await supabase.rpc("tum_aktif_personel_listesi")
    : { data: [] };

  const sekmeler = [
    { key: "ise_alim", label: "İşe Alım" },
    { key: "cikarma", label: "İşten Çıkarma" },
    { key: "rotasyon", label: "Rotasyon" },
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
      {tur === "ise_alim" && <TalepForm magazalar={magazalar ?? []} />}
      {tur === "cikarma" && <CikarmaForm personelListesi={personelListesi} />}
      {tur === "rotasyon" && <RotasyonForm personelListesi={tumPersonel ?? []} magazalar={tumMagazalar ?? []} />}
    </div>
  );
}
