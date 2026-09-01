import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VerilerTablosu from "./VerilerTablosu";

export default async function VerilerPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (me?.rol !== "YONETIM") redirect("/dashboard");

  return (
    <div>
      <div className="text-sm font-semibold text-navy-3 mb-1">İçe Aktarılan Veriler</div>
      <div className="text-[11px] text-gray-400 mb-3">
        Excel importlarıyla (veya elle) sisteme giren ham verileri buradan doğrulayabilirsiniz.
      </div>
      <VerilerTablosu />
    </div>
  );
}
