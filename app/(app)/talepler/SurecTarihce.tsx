"use client";

type Olay = { tarih: string; baslik: string; detay?: string | null };

export default function SurecTarihce({ olaylar }: { olaylar: Olay[] }) {
  if (olaylar.length === 0) {
    return <div className="text-[11px] text-gray-400 p-2">Tarihçe kaydı bulunamadı.</div>;
  }

  return (
    <div className="relative pl-4 py-1">
      <div className="absolute left-[5px] top-1 bottom-1 w-px bg-gray-200" />
      <div className="space-y-3">
        {olaylar.map((o, i) => (
          <div key={i} className="relative">
            <div className="absolute -left-4 top-0.5 w-2.5 h-2.5 rounded-full bg-navy border-2 border-white shadow-sm" />
            <div className="text-[11px] font-medium text-navy-3">{o.baslik}</div>
            <div className="text-[10px] text-gray-400 font-mono">
              {new Date(o.tarih).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
            {o.detay && <div className="text-[11px] text-gray-600 mt-0.5 italic">"{o.detay}"</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
