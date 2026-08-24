"use client";

import { useRef, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { iceAktarMagazaNorm } from "./actions";

type Sonuc = { basarili: number; hatalar: { satir: number; hata: string }[]; yetkiHatasi?: string };

export default function ImportForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [dosyaAdi, setDosyaAdi] = useState<string | null>(null);
  const [satirSayisi, setSatirSayisi] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [okumaHatasi, setOkumaHatasi] = useState<string | null>(null);

  function dosyaSec(file: File) {
    setOkumaHatasi(null);
    setSonuc(null);
    setDosyaAdi(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        setRows(json);
        setSatirSayisi(json.length);
      } catch (err: any) {
        setOkumaHatasi("Dosya okunamadı: " + err.message);
        setRows([]);
        setSatirSayisi(0);
      }
    };
    reader.readAsBinaryString(file);
  }

  function yukle() {
    if (rows.length === 0) return;
    setSonuc(null);
    startTransition(async () => {
      const res = await iceAktarMagazaNorm(rows);
      setSonuc(res);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 max-w-2xl space-y-4">
      <div>
        <div className="text-sm font-semibold text-navy-3 mb-1">Mağaza / Bölge / Norm</div>
        <div className="text-xs text-gray-400 mb-3">
          Şablon sütunları: Mağaza Kodu, Mağaza Adı, Bölge Adı, Ana Kadro Norm, Dönemsel Norm, Part-Time Norm
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-navy hover:bg-gray-50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) dosyaSec(f); }}
          />
          {dosyaAdi ? (
            <div className="text-sm text-navy-3 font-medium">✓ {dosyaAdi} — {satirSayisi} satır bulundu</div>
          ) : (
            <>
              <div className="text-2xl mb-1">📊</div>
              <div className="text-xs text-gray-400">Excel dosyasını sürükleyip bırakın ya da tıklayın (.xlsx)</div>
            </>
          )}
        </div>

        {okumaHatasi && <div className="text-xs text-danger mt-2">{okumaHatasi}</div>}

        <button
          onClick={yukle}
          disabled={pending || rows.length === 0}
          className="mt-3 bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Yükleniyor..." : `${satirSayisi} Satırı İçe Aktar`}
        </button>
      </div>

      {sonuc?.yetkiHatasi && (
        <div className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">{sonuc.yetkiHatasi}</div>
      )}

      {sonuc && !sonuc.yetkiHatasi && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <div className="text-sm">
            <span className="text-success font-semibold">{sonuc.basarili} satır</span> başarıyla içe aktarıldı.
            {sonuc.hatalar.length > 0 && (
              <span className="text-danger font-semibold"> {sonuc.hatalar.length} satır</span>
            )}
            {sonuc.hatalar.length > 0 && " hatalı."}
          </div>
          {sonuc.hatalar.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
                    <th className="text-left px-2 py-1.5">Satır</th>
                    <th className="text-left px-2 py-1.5">Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {sonuc.hatalar.map((h, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 font-mono text-gray-500">{h.satir}</td>
                      <td className="px-2 py-1.5 text-danger">{h.hata}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
