"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { guncelleAdayCv } from "../adaylar/actions";

export default function CvModal({ adayId, talepId, mevcutCv, onClose, onDone }: {
  adayId: string; talepId: string; mevcutCv: string | null; onClose: () => void; onDone: () => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function dosyaYukle(file: File) {
    setHata(null);
    if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type)) {
      setHata("Sadece PDF veya Word dosyası yükleyebilirsiniz.");
      return;
    }
    setYukleniyor(true);
    const yol = `${talepId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("cv-dosyalar").upload(yol, file);
    if (error) {
      setYukleniyor(false);
      setHata("Yükleme başarısız: " + error.message);
      return;
    }
    const fd = new FormData();
    fd.set("aday_id", adayId);
    fd.set("cv_yolu", yol);
    await guncelleAdayCv(fd);
    setYukleniyor(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-navy-3/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-navy-3">{mevcutCv ? "CV Güncelle" : "CV Ekle"}</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setSurukleniyor(true); }}
          onDragLeave={() => setSurukleniyor(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSurukleniyor(false);
            const file = e.dataTransfer.files?.[0];
            if (file) dosyaYukle(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            surukleniyor ? "border-navy bg-info-bg" : "border-gray-300 hover:border-navy hover:bg-gray-50"
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) dosyaYukle(f); }} />
          {yukleniyor ? (
            <div className="text-xs text-gray-400">Yükleniyor...</div>
          ) : (
            <>
              <div className="text-2xl mb-2">📄</div>
              <div className="text-xs text-gray-400">CV'yi sürükleyip bırakın ya da tıklayın (PDF/Word)</div>
            </>
          )}
        </div>
        {hata && <div className="text-[11px] text-danger mt-2">{hata}</div>}
      </div>
    </div>
  );
}
