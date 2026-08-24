import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ImportForm from "./ImportForm";

export default async function VeriAktarimPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (me?.rol !== "YONETIM") redirect("/dashboard");

  return <ImportForm />;
}
