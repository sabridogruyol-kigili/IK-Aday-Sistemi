// TODO: Supabase'ten gerçek veriler çekilecek (norm/dolu oranı, açık talepler, turnover)
// TODO: Rol bazlı veri kapsaması (BM: kendi bölgesi, İK: sorumlu bölge, Yönetim: tümü)

const kpis = [
  { label: "Toplam Talep", value: "—" },
  { label: "Bekleyen Talep", value: "—" },
  { label: "Onaylanan Talep", value: "—" },
  { label: "Norm Doluluk Oranı", value: "—" },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Norm Kadro Dashboard</div>
        <div className="text-xs text-gray-400 mt-0.5">Rol bazlı özet — veri bağlantısı yapılacak</div>
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
        <div className="text-xs text-gray-400">Bölge/mağaza kırılımlı norm-doluluk grafiği burada görünecek.</div>
      </div>
    </div>
  );
}
