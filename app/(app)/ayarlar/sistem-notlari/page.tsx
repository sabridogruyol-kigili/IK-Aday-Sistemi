import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSistemNotlari } from "./actions";
import SistemNotlariListesi from "./SistemNotlariListesi";

export default async function SistemNotlariPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (me?.rol !== "YONETIM") redirect("/dashboard");

  const notlar = await getSistemNotlari();

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Sistem Notları</div>
        <div className="text-xs text-gray-400 mt-0.5">Sadece Yönetim'in görebildiği, ortak not/hatırlatma listesi</div>
      </div>
      <SistemNotlariListesi ilkNotlar={notlar} />
    </div>
  );
}
