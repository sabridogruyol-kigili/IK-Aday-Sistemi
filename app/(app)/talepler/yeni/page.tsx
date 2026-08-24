import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TalepForm from "./TalepForm";
import CikarmaForm from "./CikarmaForm";

export default async function YeniTalepPage({
  searchParams,
}: {
  searchParams: { tur?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tur = searchParams.tur === "cikarma" ? "cikarma" : "ise_alim";

  const { data: magazalar } = await supabase
    .from("magazalar").select("id, magaza_adi, magaza_kodu").eq("aktif", true).order("magaza_adi");

  const { data: personelListesi } = await supabase
    .from("personel").select("id, ad_soyad, guncel_unvan").eq("durum", "aktif").order("ad_soyad");

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Yeni Talep</div>
        <div className="text-xs text-gray-400 mt-0.5">Norm kontrolü anında yapılır</div>
      </div>
      <div className="flex gap-2 mb-4">
        <a href="/talepler/yeni?tur=ise_alim"
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${tur === "ise_alim" ? "bg-navy text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
          İşe Alım
        </a>
        <a href="/talepler/yeni?tur=cikarma"
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${tur === "cikarma" ? "bg-navy text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
          İşten Çıkarma
        </a>
      </div>
      {tur === "ise_alim"
        ? <TalepForm magazalar={magazalar ?? []} />
        : <CikarmaForm personelListesi={personelListesi ?? []} />}
    </div>
  );
}
