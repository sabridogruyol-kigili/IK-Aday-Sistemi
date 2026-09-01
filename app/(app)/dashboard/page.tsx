import { createClient } from "@/lib/supabase/server";
import DashboardPaneller from "./DashboardPaneller";

export default async function DashboardPage() {
  const supabase = createClient();

  // RLS otomatik olarak kullanıcının rolüne göre satırları daraltıyor —
  // burada ekstra rol filtresi yazmaya gerek yok.
  const [
    { count: toplamTalep },
    { count: bekleyenTalep },
    { count: onaylananTalep },
    { data: magazalarHam },
    { data: personelList },
    { data: bolgeler },
    { data: performansHam },
  ] = await Promise.all([
    supabase.from("talepler").select("*", { count: "exact", head: true }),
    supabase.from("talepler").select("*", { count: "exact", head: true }).eq("durum", "BEKLEMEDE"),
    supabase.from("talepler").select("*", { count: "exact", head: true }).eq("durum", "KABUL_EDILDI"),
    supabase
      .from("magazalar")
      .select("id, magaza_kodu, magaza_adi, bolge_id, subetipi, net_m2, aktif, istifa_turnover, fesih_turnover, toplam_turnover, norm(ana_kadro_norm, donemsel_norm, part_time_norm)")
      .eq("aktif", true),
    supabase.from("personel").select("id, guncel_magaza_id, kadro_kategorisi").eq("durum", "aktif"),
    supabase.from("bolgeler").select("id, ad").order("ad"),
    supabase
      .from("performans_magaza_aylik")
      .select("magaza_id, yil, ay, hgo, sepet_ortalamasi, sepet_derinligi, donusum_orani, giren_musteri_sayisi, adet_hgo, satis_adeti, toplam_ciro_kdv_dahil, omnichannel_ciro, omnichannel_haric_ciro"),
  ]);

  // Mağaza başına, kadro kategorisine göre ayrı ayrı aktif personel sayısı
  const doluMap: Record<string, { ANA_KADRO: number; DONEMSEL: number; PART_TIME: number }> = {};
  (personelList ?? []).forEach((p: any) => {
    if (!p.guncel_magaza_id) return;
    if (!doluMap[p.guncel_magaza_id]) doluMap[p.guncel_magaza_id] = { ANA_KADRO: 0, DONEMSEL: 0, PART_TIME: 0 };
    if (p.kadro_kategorisi === "ANA_KADRO" || p.kadro_kategorisi === "DONEMSEL" || p.kadro_kategorisi === "PART_TIME") {
      doluMap[p.guncel_magaza_id][p.kadro_kategorisi as "ANA_KADRO" | "DONEMSEL" | "PART_TIME"]++;
    }
  });

  const bolgeMap: Record<string, string> = {};
  (bolgeler ?? []).forEach((b: any) => { bolgeMap[b.id] = b.ad; });

  const magazaDetay = (magazalarHam ?? []).map((m: any) => {
    const normRow = Array.isArray(m.norm) ? m.norm[0] : m.norm;
    const anaNorm = normRow?.ana_kadro_norm ?? 0;
    const donemselNorm = normRow?.donemsel_norm ?? 0;
    const partNorm = normRow?.part_time_norm ?? 0;
    const dolu = doluMap[m.id] ?? { ANA_KADRO: 0, DONEMSEL: 0, PART_TIME: 0 };
    const toplamNorm = anaNorm + donemselNorm + partNorm;
    const toplamDolu = dolu.ANA_KADRO + dolu.DONEMSEL + dolu.PART_TIME;
    return {
      id: m.id,
      magaza_kodu: m.magaza_kodu,
      magaza_adi: m.magaza_adi,
      bolge_id: m.bolge_id,
      bolge_adi: m.bolge_id ? bolgeMap[m.bolge_id] ?? "" : "",
      subetipi: m.subetipi,
      net_m2: m.net_m2,
      istifa_turnover: m.istifa_turnover,
      fesih_turnover: m.fesih_turnover,
      toplam_turnover: m.toplam_turnover,
      ana_norm: anaNorm, ana_dolu: dolu.ANA_KADRO,
      donemsel_norm: donemselNorm, donemsel_dolu: dolu.DONEMSEL,
      part_norm: partNorm, part_dolu: dolu.PART_TIME,
      toplamNorm, toplamDolu,
      oran: toplamNorm > 0 ? Math.round((toplamDolu / toplamNorm) * 100) : 0,
    };
  });

  const toplamNormGenel = magazaDetay.reduce((s, m) => s + m.toplamNorm, 0);
  const toplamDoluGenel = magazaDetay.reduce((s, m) => s + m.toplamDolu, 0);
  const normDolulukOraniGenel = toplamNormGenel > 0 ? Math.round((toplamDoluGenel / toplamNormGenel) * 100) : 0;

  const kpis = [
    { label: "Toplam Talep", value: String(toplamTalep ?? 0) },
    { label: "Bekleyen Talep", value: String(bekleyenTalep ?? 0) },
    { label: "Onaylanan Talep", value: String(onaylananTalep ?? 0) },
    { label: "Norm Doluluk Oranı", value: `%${normDolulukOraniGenel}` },
  ];

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Norm Kadro Dashboard</div>
        <div className="text-xs text-gray-400 mt-0.5">
          Rol bazlı özet — RLS ile otomatik daraltılmış veri
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-card p-4">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">
              {k.label}
            </div>
            <div className="text-2xl font-mono font-semibold text-navy">{k.value}</div>
          </div>
        ))}
      </div>

      <DashboardPaneller magazalar={magazaDetay} bolgeler={bolgeler ?? []} performansHam={performansHam ?? []} />
    </div>
  );
}
