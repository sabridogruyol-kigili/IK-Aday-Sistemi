import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PersonelTablosu from "./PersonelTablosu";

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

  const satirlar = (personelHam ?? []).map((p: any) => ({
    id: p.id,
    ad_soyad: p.ad_soyad,
    guncel_unvan: p.guncel_unvan ?? "",
    kadro_kategorisi: p.kadro_kategorisi ?? "",
    durum: p.durum,
    kidem_ay: p.kidem_ay,
    performans_ortalama_hgo: p.performans_ortalama_hgo,
    magaza_adi: p.magazalar?.magaza_adi ?? "",
    bolge_adi: p.magazalar?.bolgeler?.ad ?? "",
  }));

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
