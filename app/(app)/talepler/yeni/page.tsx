import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TalepForm from "./TalepForm";

export default async function YeniTalepPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: magazalar } = await supabase
    .from("magazalar")
    .select("id, magaza_adi, magaza_kodu")
    .eq("aktif", true)
    .order("magaza_adi");

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Yeni Talep — İşe Alım</div>
        <div className="text-xs text-gray-400 mt-0.5">
          Norm kontrolü anında yapılır, aşım halinde açıklama ile devam edebilirsiniz
        </div>
      </div>
      <TalepForm magazalar={magazalar ?? []} />
    </div>
  );
}
