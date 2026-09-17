import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdaylarSekmeler from "./AdaylarSekmeler";

export default async function AdaylarLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (me?.rol === "BORDRO") redirect("/evrak-onay");

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Aday Havuzu</div>
        <div className="text-xs text-gray-400 mt-0.5">
          Talepten bağımsız aday arşivi ve olumsuz referans listesi — ana menüde tek başlık altında, sekmeli olarak.
        </div>
      </div>
      <AdaylarSekmeler />
      {children}
    </div>
  );
}
