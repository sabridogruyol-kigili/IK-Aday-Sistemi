import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();

  // RLS otomatik olarak kullanıcının rolüne göre satırları daraltıyor —
  // burada ekstra rol filtresi yazmaya gerek yok.
  const [
    { count: toplamTalep },
    { count: bekleyenTalep },
    { count: onaylananTalep },
    { data: magazalar },
    { data: personelList },
  ] = await Promise.all([
    supabase.from("talepler").select("*", { count: "exact", head: true }),
    supabase
      .from("talepler")
      .select("*", { count: "exact", head: true })
      .eq("durum", "BEKLEMEDE"),
    supabase
      .from("talepler")
      .select("*", { count: "exact", head: true })
      .eq("durum", "KABUL_EDILDI"),
    supabase
      .from("magazalar")
      .select("id, magaza_kodu, magaza_adi, aktif, norm(ana_kadro_norm, donemsel_norm, part_time_norm)")
      .eq("aktif", true),
    supabase.from("personel").select("id, guncel_magaza_id").eq("durum", "aktif"),
  ]);

  // Mağaza başına aktif personel sayısı
  const personelSayacMagaza: Record<string, number> = {};
  (personelList ?? []).forEach((p) => {
    if (p.guncel_magaza_id) {
      personelSayacMagaza[p.guncel_magaza_id] =
        (personelSayacMagaza[p.guncel_magaza_id] ?? 0) + 1;
    }
  });

  // Mağaza bazlı norm/doluluk hesabı
  const magazaDetay = (magazalar ?? []).map((m) => {
    const normRow = Array.isArray(m.norm) ? m.norm[0] : m.norm;
    const toplamNorm =
      (normRow?.ana_kadro_norm ?? 0) +
      (normRow?.donemsel_norm ?? 0) +
      (normRow?.part_time_norm ?? 0);
    const doluSayi = personelSayacMagaza[m.id] ?? 0;
    const oran = toplamNorm > 0 ? Math.round((doluSayi / toplamNorm) * 100) : 0;
    return { ...m, toplamNorm, doluSayi, oran };
  });

  const toplamNormGenel = magazaDetay.reduce((s, m) => s + m.toplamNorm, 0);
  const toplamDoluGenel = magazaDetay.reduce((s, m) => s + m.doluSayi, 0);
  const normDolulukOraniGenel =
    toplamNormGenel > 0 ? Math.round((toplamDoluGenel / toplamNormGenel) * 100) : 0;

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

      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-sm font-semibold text-navy-3 mb-3">Mağaza Detay Grafiği</div>
        {magazaDetay.length === 0 ? (
          <div className="text-xs text-gray-400">Görüntülenebilir mağaza bulunamadı.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {magazaDetay.map((m) => (
              <div key={m.id} className="border border-gray-100 rounded-md p-2" title={m.magaza_adi}>
                <div className="text-[11px] text-gray-600 truncate mb-1">{m.magaza_adi}</div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-navy rounded-full"
                    style={{ width: `${Math.min(m.oran, 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {m.doluSayi}/{m.toplamNorm} (%{m.oran})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
