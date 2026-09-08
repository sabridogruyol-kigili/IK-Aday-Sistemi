"use client";

import { useEffect, useState } from "react";
import { getCvSignedUrl } from "./actions";

export default function CvGoruntuleyici({ cvYolu, onClose }: { cvYolu: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    getCvSignedUrl(cvYolu).then((sonuc) => {
      if (iptal) return;
      if (sonuc.error) setHata(sonuc.error);
      else setUrl(sonuc.url ?? null);
    });
    return () => { iptal = true; };
  }, [cvYolu]);

  const dosyaAdiKucuk = cvYolu.toLocaleLowerCase("tr-TR");
  const wordDosyasi = dosyaAdiKucuk.endsWith(".doc") || dosyaAdiKucuk.endsWith(".docx");

  return (
    <div className="fixed inset-0 bg-navy-3/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-card border border-gray-200 w-full max-w-3xl h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="text-sm font-semibold text-navy-3">CV Görüntüle</div>
          <div className="flex items-center gap-3">
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-info hover:underline">
                Yeni sekmede aç
              </a>
            )}
            <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {hata ? (
            <div className="h-full flex items-center justify-center text-xs text-danger p-6 text-center">{hata}</div>
          ) : !url ? (
            <div className="h-full flex items-center justify-center gap-2 text-xs text-gray-400">
              <span className="yukleniyor-donen" /> CV yükleniyor...
            </div>
          ) : wordDosyasi ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-xs text-gray-400 p-6 text-center">
              Word belgeleri tarayıcıda doğrudan önizlenemiyor.
              <a href={url} target="_blank" rel="noopener noreferrer" className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium">
                Dosyayı indir / aç
              </a>
            </div>
          ) : (
            <iframe src={url} className="w-full h-full border-0" title="CV" />
          )}
        </div>
      </div>
    </div>
  );
}
