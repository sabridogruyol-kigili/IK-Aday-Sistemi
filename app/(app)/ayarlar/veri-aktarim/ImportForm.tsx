"use client";

import { useRef, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { iceAktarMagazaNorm } from "./actions";
import { iceAktarPersonel } from "./actions-personel";
import { iceAktarPerformans } from "./actions-performans";
import { iceAktarMagazaBilgisi } from "./actions-magazabilgisi";

type Sonuc = { basarili: number; hatalar: { satir: number; hata: string }[]; yetkiHatasi?: string; eslenemeyenSutunlar?: string[] };

type Sablon = {
  key: string;
  label: string;
  aciklama: string;
  action: (rows: any[]) => Promise<Sonuc>;
};

const SABLONLAR: Sablon[] = [
  {
    key: "norm",
    label: "Mağaza / Bölge / Norm",
    aciklama: "Şablon sütunları: Mağaza Kodu, Mağaza Adı, Bölge Adı, Ana Kadro Norm, Dönemsel Norm, Part-Time Norm",
    action: iceAktarMagazaNorm,
  },
  {
    key: "personel",
    label: "Personel",
    aciklama:
      "Şablon sütunları: Personel Kodu, TC Kimlik No, Adı-Soyadı, Departman Kodu, Departman Açıklaması, İş Ünvanı Açıklaması, İşyeri Başlama Tarihi, İşten Ayrılma Tarihi, Doğum Tarihi, Cinsiyet Açıklaması, Bölge Açıklama, Bölge Müdürü Açıklama, İlk Başlama Tarihi. Not: İşten Ayrılma Tarihi dolu olan satırlar otomatik atlanır. Mağaza (Departman Kodu) sistemde önceden kayıtlı olmalı.",
    action: iceAktarPersonel,
  },
  {
    key: "performans",
    label: "Performans",
    aciklama:
      "Şablon sütunları: YIL, AY, Şubeler, Plasiyer Adı, Plasiyer Kodu, Title, Plasiyer Hedef Ciro (Kdv Dahil), Toplam Ciro KDV Dahil, ... Not: Personel önceden içe aktarılmış olmalı (Plasiyer Kodu, Personel Kodu ile eşleştirilir). 'Total' satırları mağaza aylık HGO'ya, kişi satırları kişi aylık HGO'ya yazılır.",
    action: iceAktarPerformans,
  },
  {
    key: "magazabilgisi",
    label: "Mağaza Bilgisi",
    aciklama:
      "Sabit sütunlar: Şube Listesi (kod+ad birleşik, örn 'A003 İstanbul Carousel'), Bölge Listesi, SUBETIPI, NETM2. Bunların dışındaki her sütun bir ay-metrik kombinasyonu olarak okunur (başlıkta ay adı/numarası + yıl + SEPET ORTALAMASI / SEPET DERİNLİĞİ / DÖNÜŞÜM ORANI / GİREN MÜŞTERİ SAYISI ifadelerinden biri geçmeli). Mağaza sistemde yoksa otomatik oluşturulur. Sütun başlığı tanınamazsa aşağıda listelenir — gerekirse başlığı standardize edip tekrar deneyin.",
    action: iceAktarMagazaBilgisi,
  },
];

export default function ImportForm() {
  const [sablonKey, setSablonKey] = useState(SABLONLAR[0].key);
  const sablon = SABLONLAR.find((s) => s.key === sablonKey)!;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [dosyaAdi, setDosyaAdi] = useState<string | null>(null);
  const [satirSayisi, setSatirSayisi] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [ilkSutunlar, setIlkSutunlar] = useState<string[]>([]);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [okumaHatasi, setOkumaHatasi] = useState<string | null>(null);

  function sablonDegistir(key: string) {
    setSablonKey(key);
    setDosyaAdi(null);
    setSatirSayisi(0);
    setRows([]);
    setIlkSutunlar([]);
    setSonuc(null);
    setOkumaHatasi(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
        setIlkSutunlar(json.length > 0 ? Object.keys(json[0] as object) : []);
      } catch (err: any) {
        setOkumaHatasi("Dosya okunamadı: " + err.message);
        setRows([]);
        setSatirSayisi(0);
        setIlkSutunlar([]);
      }
    };
    reader.readAsBinaryString(file);
  }

  function yukle() {
    if (rows.length === 0) return;
    setSonuc(null);
    startTransition(async () => {
      const res = await sablon.action(rows);
      setSonuc(res);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 max-w-2xl space-y-4">
      <div className="flex gap-2 border-b border-gray-100 pb-3">
        {SABLONLAR.map((s) => (
          <button
            key={s.key}
            onClick={() => sablonDegistir(s.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              sablonKey === s.key ? "bg-navy text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div>
        <div className="text-sm font-semibold text-navy-3 mb-1">{sablon.label}</div>
        <div className="text-xs text-gray-400 mb-3">{sablon.aciklama}</div>

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

        {ilkSutunlar.length > 0 && (
          <div className="mt-2 text-[10px] text-gray-400">
            <span className="font-semibold">Bulunan sütunlar:</span> {ilkSutunlar.join(", ")}
          </div>
        )}

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
          {sonuc.eslenemeyenSutunlar && sonuc.eslenemeyenSutunlar.length > 0 && (
            <div className="bg-accent/10 text-accent text-xs rounded-md px-3 py-2 border border-accent/30">
              <div className="font-semibold mb-1">Tanınamayan {sonuc.eslenemeyenSutunlar.length} sütun (aylık metrik olarak okunamadı, atlandı):</div>
              <div className="text-[11px] text-navy-3">{sonuc.eslenemeyenSutunlar.join(", ")}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
