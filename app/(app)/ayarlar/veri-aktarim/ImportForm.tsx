"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { iceAktarMagazaNorm } from "./actions";
import { iceAktarPersonel } from "./actions-personel";
import { iceAktarTurnover } from "./actions-turnover";
import { iceAktarMagazaPerformans } from "./actions-magaza-performans";
import { getSonImportlar, kaydetImportGecmisi, type SonImport } from "./actions-gecmis";

type Sonuc = { basarili: number; hatalar: { satir: number; hata: string }[]; yetkiHatasi?: string; eslenemeyenSutunlar?: string[] };

type Sablon = {
  key: string;
  label: string;
  aciklama: string;
  action: (rows: any[]) => Promise<Sonuc>;
  parcaBoyutu: number;
};

const SABLONLAR: Sablon[] = [
  {
    key: "norm",
    label: "Mağaza / Bölge / Norm",
    aciklama: "Şablon sütunları: Mağaza Kodu, Mağaza Adı, Bölge Adı, Ana Kadro Norm, Dönemsel Norm, Part-Time Norm",
    action: iceAktarMagazaNorm,
    parcaBoyutu: 2000,
  },
  {
    key: "personel",
    label: "Personel",
    aciklama:
      "Şablon sütunları: Personel Kodu, TC Kimlik No, Adı-Soyadı, Departman Kodu, Departman Açıklaması, İş Ünvanı Açıklaması, İşyeri Başlama Tarihi, İşten Ayrılma Tarihi, Doğum Tarihi, Cinsiyet Açıklaması, Bölge Açıklama, Bölge Müdürü Açıklama, İlk Başlama Tarihi. Not: İşten Ayrılma Tarihi dolu olan satırlar otomatik atlanır. Mağaza (Departman Kodu) sistemde önceden kayıtlı olmalı.",
    action: iceAktarPersonel,
    parcaBoyutu: 800,
  },
  {
    key: "turnover",
    label: "Turnover",
    aciklama:
      "Şablon sütunları: Mağaza Kodu, İstifa Turnover, Fesih Turnover, Toplam Turnover. Kümülatif bir bilgidir (aylık değil) — her mağaza için tek bir değer olarak üzerine yazılır. Mağaza sistemde önceden kayıtlı olmalı.",
    action: iceAktarTurnover,
    parcaBoyutu: 2000,
  },
  {
    key: "magaza_performans",
    label: "Mağaza Performans Dosyası",
    aciklama:
      "Mağaza Bilgisi ve Performans'ın birleştiği tek dosya. Her mağaza+ay için önce kişi satırları, en altta mağaza toplamını temsil eden bir 'Total' satırı gelir (Total satırında mağaza kodu yazmaz, bir önceki satırlardan otomatik takip edilir). HGO (hem Ciro hem Adet) dosyada hazır gelmiyor, gerçekleşen/hedef oranından hesaplanır. Sicili sistemde olmayan kişiler otomatik oluşturulur, ünvan kısaltmaları (MAĞAZA MD. vb.) tam ünvana çevrilip kategoriye bağlanır.",
    action: iceAktarMagazaPerformans,
    parcaBoyutu: 1500,
  },
];

export default function ImportForm({ onBasarili }: { onBasarili?: () => void } = {}) {
  const [sablonKey, setSablonKey] = useState(SABLONLAR[0].key);
  const sablon = SABLONLAR.find((s) => s.key === sablonKey)!;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [dosyaAdi, setDosyaAdi] = useState<string | null>(null);
  const [satirSayisi, setSatirSayisi] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [ilkSutunlar, setIlkSutunlar] = useState<string[]>([]);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [sonImportlar, setSonImportlar] = useState<Record<string, SonImport>>({});

  useEffect(() => {
    getSonImportlar().then(setSonImportlar);
  }, []);
  const [okumaHatasi, setOkumaHatasi] = useState<string | null>(null);
  const [surukleniyor, setSurukleniyor] = useState(false);

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

  // Gerçek Personel dosyası ~90 sütun içerebiliyor (Sicil Numarası, SGK bilgileri, adres vb.) —
  // bunların hepsini sunucuya göndermek 413 (istek çok büyük) hatasına yol açıyor. Sadece
  // gerçekten kullandığımız sütunları (başlık boşluk/satır sonu normalize edilmiş hâliyle) ayıklıyoruz.
  const PERSONEL_GEREKLI_SUTUNLAR = [
    "Personel Kodu", "TC Kimlik No", "Adı-Soyadı", "Departman Kodu", "Departman Açıklaması",
    "İş Ünvanı Açıklaması", "İşyeri Başlama Tarihi", "İşten Ayrılma Tarihi", "Doğum Tarihi",
    "Cinsiyet Açıklaması", "Bölge Açıklama", "Bölge Müdürü Açıklama", "İlk Başlama Tarihi",
    "Önceki İş Yeri", "İHTARNAME Açıklama", "UYARI YAZISI Açıklama", "Tutanak Açıklama",
    "Savunma Açıklama", "Kan Grubu Kodu", "Uyruk", "ÖzelMobil", "Evli", "PlainText",
  ];

  function baslikNormallestirClient(s: string): string {
    return s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function personelSutunlariniAyikla(json: any[]): any[] {
    const gerekliSet = new Set(PERSONEL_GEREKLI_SUTUNLAR);
    return json.map((satir) => {
      const yeni: Record<string, any> = {};
      for (const kolonAdi of Object.keys(satir)) {
        const normalize = baslikNormallestirClient(kolonAdi);
        if (gerekliSet.has(normalize)) yeni[normalize] = satir[kolonAdi];
      }
      return yeni;
    });
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

        if (sablonKey === "personel") {
          const jsonHam = XLSX.utils.sheet_to_json(sheet);
          const json = personelSutunlariniAyikla(jsonHam);
          setRows(json);
          setSatirSayisi(json.length);
          setIlkSutunlar(jsonHam.length > 0 ? Object.keys(jsonHam[0] as object) : []);
        } else {
          const json = XLSX.utils.sheet_to_json(sheet);
          setRows(json);
          setSatirSayisi(json.length);
          setIlkSutunlar(json.length > 0 ? Object.keys(json[0] as object) : []);
        }
      } catch (err: any) {
        setOkumaHatasi("Dosya okunamadı: " + err.message);
        setRows([]);
        setSatirSayisi(0);
        setIlkSutunlar([]);
      }
    };
    reader.readAsBinaryString(file);
  }

  function suruklemeUzerinden(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setSurukleniyor(true);
  }

  function suruklemeAyrildi(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setSurukleniyor(false);
  }

  function birakildi(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setSurukleniyor(false);
    const dosya = e.dataTransfer.files?.[0];
    if (!dosya) return;
    if (!/\.(xlsx|xls)$/i.test(dosya.name)) {
      setOkumaHatasi("Sadece .xlsx veya .xls dosyaları kabul edilir.");
      return;
    }
    dosyaSec(dosya);
  }

  const [ilerleme, setIlerleme] = useState<{ mevcut: number; toplam: number } | null>(null);

  function parcala<T>(dizi: T[], boyut: number): T[][] {
    const parcalar: T[][] = [];
    for (let i = 0; i < dizi.length; i += boyut) parcalar.push(dizi.slice(i, i + boyut));
    return parcalar;
  }

  function yukle() {
    if (rows.length === 0) return;
    setSonuc(null);
    const parcalar = parcala(rows, sablon.parcaBoyutu);
    setIlerleme({ mevcut: 0, toplam: parcalar.length });

    startTransition(async () => {
      let toplamBasarili = 0;
      const tumHatalar: { satir: number; hata: string }[] = [];
      let tumEslenemeyenSutunlar: string[] | undefined;
      let yetkiHatasi: string | undefined;

      for (let i = 0; i < parcalar.length; i++) {
        const res = await sablon.action(parcalar[i]);
        if (res.yetkiHatasi) { yetkiHatasi = res.yetkiHatasi; break; }
        toplamBasarili += res.basarili;
        tumHatalar.push(...res.hatalar);
        if (res.eslenemeyenSutunlar) tumEslenemeyenSutunlar = res.eslenemeyenSutunlar;
        setIlerleme({ mevcut: i + 1, toplam: parcalar.length });
      }

      setIlerleme(null);
      setSonuc({ basarili: toplamBasarili, hatalar: tumHatalar, yetkiHatasi, eslenemeyenSutunlar: tumEslenemeyenSutunlar });
      if (!yetkiHatasi) {
        kaydetImportGecmisi(sablon.key, toplamBasarili, tumHatalar.length).then(() => {
          getSonImportlar().then(setSonImportlar);
        });
        if (toplamBasarili > 0) onBasarili?.();
      }
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
        <div className="text-xs text-gray-400 mb-2">{sablon.aciklama}</div>
        {sonImportlar[sablon.key] && (
          <div className="text-[11px] text-gray-500 bg-gray-50 rounded-md px-2.5 py-1.5 mb-3 inline-block">
            Son içe aktarım: {new Date(sonImportlar[sablon.key].created_at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
            {sonImportlar[sablon.key].kullanici_adi && ` — ${sonImportlar[sablon.key].kullanici_adi}`}
            {" — "}
            <span className="text-success font-medium">{sonImportlar[sablon.key].basarili} başarılı</span>
            {sonImportlar[sablon.key].hatali > 0 && <span className="text-danger font-medium"> / {sonImportlar[sablon.key].hatali} hatalı</span>}
          </div>
        )}

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={suruklemeUzerinden}
          onDragEnter={suruklemeUzerinden}
          onDragLeave={suruklemeAyrildi}
          onDrop={birakildi}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            surukleniyor ? "border-navy bg-gray-50" : "border-gray-300 hover:border-navy hover:bg-gray-50"
          }`}
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
        {ilerleme && (
          <div className="mt-2">
            <div className="text-[11px] text-gray-400 mb-1">
              Parça {ilerleme.mevcut} / {ilerleme.toplam} işleniyor — büyük dosyalar birkaç dakika sürebilir, sayfayı kapatmayın.
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full max-w-xs">
              <div className="h-full bg-navy rounded-full transition-all" style={{ width: `${(ilerleme.mevcut / ilerleme.toplam) * 100}%` }} />
            </div>
          </div>
        )}
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
