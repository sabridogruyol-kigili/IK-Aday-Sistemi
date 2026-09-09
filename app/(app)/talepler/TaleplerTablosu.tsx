"use client";

import { useMemo, useState } from "react";
import TalepRow from "./TalepRow";

const TALEP_TURU_ETIKET: Record<string, string> = { ISE_ALIM: "İşe Alım", ISTEN_CIKARMA: "İşten Çıkarma", ROTASYON: "Rotasyon", NORM_DEGISIKLIK: "Norm Değişikliği" };

export default function TaleplerTablosu({ talepler, benimKullaniciId, benimRolum }: {
  talepler: any[]; benimKullaniciId: string; benimRolum: string;
}) {
  const [kategoriFiltre, setKategoriFiltre] = useState<"AKTIF" | "PASIF" | "TUMU">("AKTIF");
  const [acanFiltre, setAcanFiltre] = useState("");
  const [turFiltre, setTurFiltre] = useState("");
  const [arama, setArama] = useState("");

  // Filtreler birbirini etkiler: her dropdown, DİĞER filtrelerin sonucuna göre
  // daralmış seçenek listesi gösterir (örn. tür seçilince açan listesi sadece
  // o türü açmış kişilere iner).
  const kategoriyeGoreFiltrelenmis = useMemo(
    () => talepler.filter((t) => kategoriFiltre === "TUMU" || t.kategori === kategoriFiltre),
    [talepler, kategoriFiltre]
  );

  const acanListesi = useMemo(() => {
    const map = new Map<string, string>();
    kategoriyeGoreFiltrelenmis
      .filter((t) => !turFiltre || t.talep_turu === turFiltre)
      .forEach((t) => { if (t.acan_kullanici_id && t.acanAdi) map.set(t.acan_kullanici_id, t.acanAdi); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "tr"));
  }, [kategoriyeGoreFiltrelenmis, turFiltre]);

  const turListesi = useMemo(() => {
    const set = new Set<string>();
    kategoriyeGoreFiltrelenmis
      .filter((t) => !acanFiltre || t.acan_kullanici_id === acanFiltre)
      .forEach((t) => set.add(t.talep_turu));
    return Array.from(set);
  }, [kategoriyeGoreFiltrelenmis, acanFiltre]);

  const filtrelenmis = useMemo(() => {
    return kategoriyeGoreFiltrelenmis.filter((t) => {
      if (acanFiltre && t.acan_kullanici_id !== acanFiltre) return false;
      if (turFiltre && t.talep_turu !== turFiltre) return false;
      if (arama) {
        const q = arama.toLocaleLowerCase("tr-TR");
        const hedefMetin = `${t.talep_no} ${t.magazalar?.magaza_adi ?? ""} ${t.acanAdi ?? ""} ${t.pozisyon_tipi ?? ""}`.toLocaleLowerCase("tr-TR");
        if (!hedefMetin.includes(q)) return false;
      }
      return true;
    });
  }, [kategoriyeGoreFiltrelenmis, acanFiltre, turFiltre, arama]);

  // Seçili ama artık mevcut seçeneklerde olmayan bir filtre kalırsa (diğer
  // filtre daraltınca) otomatik temizlensin diye basit bir koruma.
  if (acanFiltre && !acanListesi.some(([id]) => id === acanFiltre)) {
    queueMicrotask(() => setAcanFiltre(""));
  }
  if (turFiltre && !turListesi.includes(turFiltre)) {
    queueMicrotask(() => setTurFiltre(""));
  }

  const aktifSayisi = talepler.filter((t) => t.kategori === "AKTIF").length;
  const pasifSayisi = talepler.filter((t) => t.kategori === "PASIF").length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          <button onClick={() => setKategoriFiltre("AKTIF")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${kategoriFiltre === "AKTIF" ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            Aktif ({aktifSayisi})
          </button>
          <button onClick={() => setKategoriFiltre("PASIF")}
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 transition-colors ${kategoriFiltre === "PASIF" ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            Pasif ({pasifSayisi})
          </button>
          <button onClick={() => setKategoriFiltre("TUMU")}
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 transition-colors ${kategoriFiltre === "TUMU" ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            Tümü ({talepler.length})
          </button>
        </div>

        <select value={acanFiltre} onChange={(e) => setAcanFiltre(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
          <option value="">Tüm Açanlar ({acanListesi.length})</option>
          {acanListesi.map(([id, ad]) => <option key={id} value={id}>{ad}</option>)}
        </select>

        <select value={turFiltre} onChange={(e) => setTurFiltre(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
          <option value="">Tüm Türler</option>
          {turListesi.map((k) => <option key={k} value={k}>{TALEP_TURU_ETIKET[k] ?? k}</option>)}
        </select>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Talep no, mağaza, açan, pozisyon ara..."
            className="w-full border border-gray-300 rounded-md pl-7 pr-2 py-1.5 text-xs bg-white focus:outline-none"
          />
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
            <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </div>

        <div className="text-[11px] text-gray-400 ml-auto">
          {filtrelenmis.length === kategoriyeGoreFiltrelenmis.length ? `${filtrelenmis.length} talep` : `${filtrelenmis.length} / ${kategoriyeGoreFiltrelenmis.length} talep`}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-navy-3/70 uppercase border-b-2 border-navy">
              <th className="text-left px-3 py-2">Talep No</th>
              <th className="text-left px-3 py-2">Tür</th>
              <th className="text-left px-3 py-2">Mağaza</th>
              <th className="text-left px-3 py-2">Açan</th>
              <th className="text-left px-3 py-2">Pozisyon</th>
              <th className="text-left px-3 py-2">Kişi</th>
              <th className="text-left px-3 py-2">Gönderim</th>
              <th className="text-left px-3 py-2">Durum</th>
              <th className="text-left px-3 py-2">Süreç</th>
              <th className="text-left px-3 py-2">Tarih</th>
              <th className="text-left px-3 py-2">Detay</th>
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.map((t) => (
              <TalepRow
                key={t.id}
                talep={t}
                redGerekce={t.redGerekce}
                benimKullaniciId={benimKullaniciId}
                benimRolum={benimRolum}
                baslangicAdaySayisi={t.adaySayisi}
                acanAdi={t.acanAdi}
                acanRol={t.acanRol}
                benimAcimMi={t.benimAcimMi}
                gorunumEtiket={t.gorunumEtiket === "TAMAMLANDI" ? "Tamamlandı" : undefined}
              />
            ))}
            {filtrelenmis.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-400 text-xs">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-50">
                    <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
                  </svg>
                  Bu filtreye uyan talep yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
