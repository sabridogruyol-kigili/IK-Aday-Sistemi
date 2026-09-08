import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VeriYonetimi from "./VeriYonetimi";

export default async function VeriAktarimPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (me?.rol !== "YONETIM") redirect("/dashboard");

  const [{ data: bolgeler }, { data: magazalarHam }, { data: normHam }] = await Promise.all([
    supabase.from("bolgeler").select("id, ad").order("ad"),
    supabase.from("magazalar").select("id, magaza_kodu, magaza_adi, bolge_id, subetipi, net_m2, aktif").order("magaza_kodu"),
    supabase.from("norm").select("magaza_id, ana_kadro_norm, donemsel_norm, part_time_norm"),
  ]);

  const normMap: Record<string, { ana_kadro_norm: number; donemsel_norm: number; part_time_norm: number }> = {};
  (normHam ?? []).forEach((n: any) => {
    normMap[n.magaza_id] = { ana_kadro_norm: n.ana_kadro_norm ?? 0, donemsel_norm: n.donemsel_norm ?? 0, part_time_norm: n.part_time_norm ?? 0 };
  });

  const magazalar = (magazalarHam ?? []).map((m: any) => ({
    ...m,
    ...(normMap[m.id] ?? { ana_kadro_norm: 0, donemsel_norm: 0, part_time_norm: 0 }),
  }));

  return <VeriYonetimi bolgeler={bolgeler ?? []} magazalar={magazalar} />;
}
