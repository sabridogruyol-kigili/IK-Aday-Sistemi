"use client";

export type SurecAdimi = {
  baslik: string;
  tarih: string | null;
  detay?: string | null;
  durum: "TAMAMLANDI_OLUMLU" | "TAMAMLANDI_OLUMSUZ" | "TAMAMLANDI_NOTR" | "MEVCUT" | "GELECEK";
};

const NOKTA_RENK: Record<string, string> = {
  TAMAMLANDI_OLUMLU: "bg-success border-success",
  TAMAMLANDI_OLUMSUZ: "bg-danger border-danger",
  TAMAMLANDI_NOTR: "bg-navy border-navy",
  MEVCUT: "bg-accent border-accent ring-4 ring-accent/20",
  GELECEK: "bg-white border-gray-300",
};
const CIZGI_RENK: Record<string, string> = {
  TAMAMLANDI_OLUMLU: "bg-success",
  TAMAMLANDI_OLUMSUZ: "bg-danger",
  TAMAMLANDI_NOTR: "bg-navy",
  MEVCUT: "bg-gray-300",
  GELECEK: "bg-gray-200",
};
const METIN_RENK: Record<string, string> = {
  TAMAMLANDI_OLUMLU: "text-navy-3",
  TAMAMLANDI_OLUMSUZ: "text-navy-3",
  TAMAMLANDI_NOTR: "text-navy-3",
  MEVCUT: "text-accent font-semibold",
  GELECEK: "text-gray-400",
};

export default function SurecTarihce({ olaylar }: { olaylar: SurecAdimi[] }) {
  if (olaylar.length === 0) {
    return <div className="text-[11px] text-gray-400 p-2">Tarihçe kaydı bulunamadı.</div>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start w-full min-w-[560px]">
        {olaylar.map((o, i) => (
          <div key={i} className="flex items-start flex-1 min-w-[100px]">
            <div className="flex flex-col items-center text-center px-1 flex-1">
              <div className={`w-3 h-3 rounded-full border-2 mb-1 flex-shrink-0 ${NOKTA_RENK[o.durum]}`} />
              <div className={`text-[10px] leading-snug ${METIN_RENK[o.durum]}`}>{o.baslik}</div>
              <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                {o.tarih
                  ? new Date(o.tarih).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                  : o.durum === "MEVCUT" ? "şimdi" : "—"}
              </div>
              {o.detay && (
                <div className="text-[9px] text-gray-500 italic mt-0.5 line-clamp-2" title={o.detay}>
                  "{o.detay}"
                </div>
              )}
            </div>
            {i < olaylar.length - 1 && <div className={`h-0.5 flex-1 mt-[5px] ${CIZGI_RENK[o.durum]}`} />}
          </div>
        ))}
      </div>
    </div>
  );
}
