"use client";

import { useState } from "react";
import ImportForm from "./ImportForm";
import VerilerTablosu from "../veriler/VerilerTablosu";

export default function VeriYonetimi() {
  const [yenilemeSayaci, setYenilemeSayaci] = useState(0);

  return (
    <div className="space-y-6">
      <ImportForm onBasarili={() => setYenilemeSayaci((c) => c + 1)} />

      <div>
        <div className="text-sm font-semibold text-navy-3 mb-1">İçe Aktarılan Veriler</div>
        <div className="text-[11px] text-gray-400 mb-3">
          Yukarıda bir import tamamlandığında bu tablo otomatik güncellenir.
        </div>
        <VerilerTablosu yenilemeTetik={yenilemeSayaci} />
      </div>
    </div>
  );
}
