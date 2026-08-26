import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NormTablosu from "./NormTablosu";

export default async function NormPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS (magazalar_select / norm_select) zaten bölge bazlı kısıtlıyor — ek filtre gerekmez.
  const { data: magazalarHam, error: magazaHata } = await supabase
    .from("magazalar")
    .select("id, magaza_kodu, magaza_adi, bolge_id, bolgeler(ad)")
    .eq("aktif", true)
    .order("magaza_adi");

  if (magazaHata) {
    return <div className="text-xs text-danger">Hata: {magazaHata.message}</div>;
  }

  const magazaIdleri = (magazalarHam ?? []).map((m: any) => m.id);

  const [normRes, personelRes] = await Promise.all([
    magazaIdleri.length > 0
      ? supabase.from("norm").select("magaza_id, ana_kadro_norm, donemsel_norm, part_time_norm").in("magaza_id", magazaIdleri)
      : Promise.resolve({ data: [] as any[] }),
    magazaIdleri.length > 0
      ? supabase.from("personel").select("guncel_magaza_id, kadro_kategorisi").eq("durum", "aktif").in("guncel_magaza_id", magazaIdleri)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const normMap: Record<string, { ana_kadro_norm: number; donemsel_norm: number; part_time_norm: number }> = {};
  (normRes.data ?? []).forEach((n: any) => {
    normMap[n.magaza_id] = {
      ana_kadro_norm: n.ana_kadro_norm ?? 0,
      donemsel_norm: n.donemsel_norm ?? 0,
      part_time_norm: n.part_time_norm ?? 0,
    };
  });

  const doluMap: Record<string, { ANA_KADRO: number; DONEMSEL: number; PART_TIME: number }> = {};
  (personelRes.data ?? []).forEach((p: any) => {
    if (!doluMap[p.guncel_magaza_id]) {
      doluMap[p.guncel_magaza_id] = { ANA_KADRO: 0, DONEMSEL: 0, PART_TIME: 0 };
    }
    if (p.kadro_kategorisi === "ANA_KADRO" || p.kadro_kategorisi === "DONEMSEL" || p.kadro_kategorisi === "PART_TIME") {
      doluMap[p.guncel_magaza_id][p.kadro_kategorisi as "ANA_KADRO" | "DONEMSEL" | "PART_TIME"]++;
    }
  });

  const satirlar = (magazalarHam ?? []).map((m: any) => {
    const norm = normMap[m.id] ?? { ana_kadro_norm: 0, donemsel_norm: 0, part_time_norm: 0 };
    const dolu = doluMap[m.id] ?? { ANA_KADRO: 0, DONEMSEL: 0, PART_TIME: 0 };
    const toplamNorm = norm.ana_kadro_norm + norm.donemsel_norm + norm.part_time_norm;
    const toplamDolu = dolu.ANA_KADRO + dolu.DONEMSEL + dolu.PART_TIME;
    return {
      id: m.id,
      magaza_kodu: m.magaza_kodu,
      magaza_adi: m.magaza_adi,
      bolge_adi: m.bolgeler?.ad ?? "",
      ana_kadro_norm: norm.ana_kadro_norm,
      ana_kadro_dolu: dolu.ANA_KADRO,
      donemsel_norm: norm.donemsel_norm,
      donemsel_dolu: dolu.DONEMSEL,
      part_time_norm: norm.part_time_norm,
      part_time_dolu: dolu.PART_TIME,
      toplam_norm: toplamNorm,
      toplam_dolu: toplamDolu,
    };
  });

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Mağazalarım / Norm Bilgisi</div>
        <div className="text-xs text-gray-400 mt-0.5">Ana Kadro / Dönemsel / Part-Time norm ve doluluk durumu</div>
      </div>
      <NormTablosu satirlar={satirlar} />
    </div>
  );
}
