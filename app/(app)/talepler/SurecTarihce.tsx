"use client";

export type TarihceOlay = { tarih: string; baslik: string; detay?: string | null };

export default function SurecTarihce({ olaylar }: { olaylar: TarihceOlay[] }) {
  if (olaylar.length === 0) {
    return <div className="text-[11px] text-gray-400 p-2">Tarihçe kaydı bulunamadı.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-start min-w-max py-1">
        {olaylar.map((o, i) => (
          <div key={i} className="flex items-start">
            <div className="flex flex-col items-center w-32 text-center px-1.5 flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-navy border-2 border-white shadow-sm mb-1" />
              <div className="text-[10px] font-medium text-navy-3 leading-snug">{o.baslik}</div>
              <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                {new Date(o.tarih).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
              {o.detay && (
                <div className="text-[9px] text-gray-500 italic mt-0.5 line-clamp-2" title={o.detay}>
                  "{o.detay}"
                </div>
              )}
            </div>
            {i < olaylar.length - 1 && <div className="h-px w-5 bg-gray-300 mt-[5px] flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
