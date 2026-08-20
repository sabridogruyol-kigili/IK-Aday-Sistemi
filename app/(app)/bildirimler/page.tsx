// TODO: 3 talep türü (İşe Alım / İşten Çıkarma / Rotasyon) için form mantığı
// TODO: Norm kontrolü (anlık) + "uygun değil" uyarısı + ısrarlı başvuru akışı

const talepTurleri = [
  { key: "ISE_ALIM", label: "İşe Alım Talebi" },
  { key: "ISTEN_CIKARMA", label: "İşten Çıkarma Talebi" },
  { key: "ROTASYON", label: "Rotasyon Talebi" },
];

export default function YeniTalepPage() {
  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Yeni Talep</div>
        <div className="text-xs text-gray-400 mt-0.5">Talep türünü seçerek başlayın</div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {talepTurleri.map((t) => (
          <button
            key={t.key}
            className="bg-white border border-gray-200 rounded-card p-5 text-left hover:border-navy transition-colors"
          >
            <div className="text-sm font-semibold text-navy-3">{t.label}</div>
            <div className="text-xs text-gray-400 mt-1">Formu doldurmak için tıklayın</div>
          </button>
        ))}
      </div>
    </div>
  );
}
