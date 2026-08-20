// TODO: Supabase "norm" + "magazalar" tablolarından rol bazlı liste çekilecek

export default function NormPage() {
  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Mağazalarım / Norm Bilgisi</div>
        <div className="text-xs text-gray-400 mt-0.5">Ana Kadro / Dönemsel / Part-Time norm ve doluluk durumu</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase tracking-wide">
              <th className="text-left p-3">Mağaza Kodu</th>
              <th className="text-left p-3">Mağaza Adı</th>
              <th className="text-left p-3">Bölge</th>
              <th className="text-left p-3">Ana Kadro</th>
              <th className="text-left p-3">Dönemsel</th>
              <th className="text-left p-3">Part-Time</th>
              <th className="text-left p-3">Dolu / Norm</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="p-6 text-center text-gray-400 text-xs">
                Veri bağlantısı yapıldığında mağaza listesi burada görünecek.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
