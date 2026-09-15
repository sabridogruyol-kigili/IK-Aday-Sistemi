"use client";

import { useEffect, useState } from "react";
import { getMagazaYorumGecmisi, magazaYorumEkle, type MagazaYorum } from "./actions-yorum";

const ROL_ETIKET: Record<string, string> = { IK: "İK", BM: "BM", YONETIM: "Yönetim" };

export default function MagazaYorumModal({
  magazaId, magazaAdi, rol, benimRolum, onClose,
}: {
  magazaId: string; magazaAdi: string; rol: "IK" | "BM" | "YONETIM"; benimRolum: string; onClose: () => void;
}) {
  const [gecmis, setGecmis] = useState<MagazaYorum[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yeniYorum, setYeniYorum] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const yazabilirMi = benimRolum === rol;

  function yukle() {
    setYukleniyor(true);
    getMagazaYorumGecmisi(magazaId, rol).then((veri) => {
      setGecmis(veri);
      setYukleniyor(false);
    });
  }

  useEffect(() => { yukle(); }, [magazaId, rol]);

  function gonder() {
    setHata(null);
    setGonderiliyor(true);
    magazaYorumEkle(magazaId, yeniYorum).then((res) => {
      setGonderiliyor(false);
      if (res.error) { setHata(res.error); return; }
      setYeniYorum("");
      yukle();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div>
            <div className="text-sm font-semibold text-navy-3">{ROL_ETIKET[rol]} Yorumları</div>
            <div className="text-[11px] text-gray-400">{magazaAdi}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {yukleniyor ? (
            <div className="text-xs text-gray-400 text-center py-6">Yükleniyor...</div>
          ) : gecmis.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-6">Henüz yorum eklenmemiş.</div>
          ) : (
            gecmis.map((y) => (
              <div key={y.id} className="border border-gray-100 bg-gray-50/50 rounded-md px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-navy-3">{y.yazan_ad_soyad}</span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(y.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="text-[12px] text-gray-700 whitespace-pre-wrap">{y.yorum}</div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-200 p-3 shrink-0">
          {yazabilirMi ? (
            <>
              <textarea
                value={yeniYorum}
                onChange={(e) => setYeniYorum(e.target.value)}
                placeholder={`Yeni ${ROL_ETIKET[rol]} yorumu ekleyin...`}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-navy resize-none"
              />
              {hata && <div className="text-[11px] text-danger mt-1">{hata}</div>}
              <button
                onClick={gonder}
                disabled={gonderiliyor || !yeniYorum.trim()}
                className="mt-2 bg-navy hover:bg-navy-2 text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-colors"
              >
                {gonderiliyor ? "Ekleniyor..." : "Yorum Ekle"}
              </button>
            </>
          ) : (
            <div className="text-[11px] text-gray-400 text-center">
              Bu bölüme sadece {ROL_ETIKET[rol]} rolündeki kullanıcılar yorum ekleyebilir.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
