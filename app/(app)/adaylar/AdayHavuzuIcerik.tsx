"use client";

import { useState } from "react";
import HavuzKarti from "./HavuzKarti";
import HavuzaAdayEkleModal from "./HavuzaAdayEkleModal";

type Havuzdaki = {
  id: string; ad_soyad: string; telefon: string | null; email: string | null;
  cv_drive_link: string | null; tc_kimlik_no: string | null; unvan: string | null; referans: string | null;
  havuz_magaza_adi?: string;
};

export default function AdayHavuzuIcerik({
  havuzdakiler, aktifIseAlimTalepleri,
}: {
  havuzdakiler: Havuzdaki[];
  aktifIseAlimTalepleri: { id: string; talep_no: string; magaza_adi: string }[];
}) {
  const [modalAcik, setModalAcik] = useState(false);
  const [referansFiltre, setReferansFiltre] = useState<"HEPSI" | "VAR" | "YOK">("HEPSI");

  const filtrelenmis = havuzdakiler.filter((h) => {
    if (referansFiltre === "VAR") return !!h.referans;
    if (referansFiltre === "YOK") return !h.referans;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex border border-gray-200 rounded-md overflow-hidden">
          {(["HEPSI", "VAR", "YOK"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setReferansFiltre(f)}
              className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                referansFiltre === f ? "bg-navy text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {f === "HEPSI" ? "Tümü" : f === "VAR" ? "Referansı Olanlar" : "Referansı Olmayanlar"}
            </button>
          ))}
        </div>
        <button onClick={() => setModalAcik(true)}
          className="bg-navy hover:bg-navy-2 text-white rounded-md px-3 py-1.5 text-xs font-medium transition-colors">
          + Yeni Aday Ekle
        </button>
      </div>

      <div className="space-y-2">
        {filtrelenmis.map((h) => (
          <HavuzKarti
            key={h.id}
            adayId={h.id}
            adSoyad={h.ad_soyad}
            telefon={h.telefon}
            email={h.email}
            cvLink={h.cv_drive_link}
            tcKimlikNo={h.tc_kimlik_no}
            havuzMagaza={h.havuz_magaza_adi}
            unvan={h.unvan}
            referans={h.referans}
            aktifIseAlimTalepleri={aktifIseAlimTalepleri}
          />
        ))}
        {filtrelenmis.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-card p-6 text-center text-gray-400 text-xs">
            {havuzdakiler.length === 0
              ? "Havuzda hiç aday yok. Bir adayı havuza almak için, ilgili talebin süreç detayında \"Beklesin\" kararı verip ardından \"Aday Havuzuna Al\"a basın, ya da \"Yeni Aday Ekle\" ile doğrudan ekleyin."
              : "Bu filtreye uyan aday yok."}
          </div>
        )}
      </div>

      {modalAcik && (
        <HavuzaAdayEkleModal onClose={() => setModalAcik(false)} onDone={() => { setModalAcik(false); window.location.reload(); }} />
      )}
    </div>
  );
}
