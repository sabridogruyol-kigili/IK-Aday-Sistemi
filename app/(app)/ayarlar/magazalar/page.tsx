import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MagazaTablosu from "./MagazaTablosu";
import BolgeYonetimi from "./BolgeYonetimi";

export default async function MagazalarPage() {
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

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-semibold text-navy-3 mb-1">Bölgeler</div>
        <BolgeYonetimi bolgeler={bolgeler ?? []} />
      </div>

      <div>
        <div className="text-sm font-semibold text-navy-3 mb-1">Mağazalar ve Norm Değerleri</div>
        <div className="text-[11px] text-gray-400 mb-2">
          Mağaza sildiğinizde, ilişkili personel/talep/performans geçmişi bozulmasın diye kayıt kalıcı silinmez — "Pasif Yap" ile pasife alınır.
        </div>
        <MagazaTablosu magazalar={magazalar} bolgeler={bolgeler ?? []} />
      </div>
    </div>
  );
}
