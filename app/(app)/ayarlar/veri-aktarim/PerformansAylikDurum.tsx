"use client";

import { useEffect, useState } from "react";
import { getPerformansAylikDurum } from "./actions-aylik-durum";

const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const SU_ANKI_YIL = new Date().getFullYear();

export default function PerformansAylikDurum() {
  const [yil, setYil] = useState(SU_ANKI_YIL);
  const [doluAylar, setDoluAylar] = useState<number[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    setYukleniyor(true);
    getPerformansAylikDurum(yil).then((aylar) => {
      setDoluAylar(aylar);
      setYukleniyor(false);
    });
  }, [yil]);

  return (
    <div className="bg-gray-50 rounded-md p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold text-navy-3 uppercase">Aylık Yükleme Durumu</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYil((y) => y - 1)} className="text-gray-400 hover:text-navy text-xs px-1">←</button>
          <span className="text-xs font-medium text-navy-3 w-10 text-center">{yil}</span>
          <button onClick={() => setYil((y) => y + 1)} className="text-gray-400 hover:text-navy text-xs px-1">→</button>
        </div>
      </div>
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
        {AY_KISA.map((etiket, i) => {
          const ayNo = i + 1;
          const dolu = doluAylar.includes(ayNo);
          return (
            <div
              key={ayNo}
              className={`text-center text-[10px] rounded-md py-1.5 font-medium ${
                yukleniyor ? "bg-gray-100 text-gray-300" : dolu ? "bg-success-bg text-success" : "bg-white border border-gray-200 text-gray-400"
              }`}
              title={dolu ? "Veri yüklenmiş" : "Henüz veri yok"}
            >
              {etiket} {dolu ? "✓" : "—"}
            </div>
          );
        })}
      </div>
    </div>
  );
}
