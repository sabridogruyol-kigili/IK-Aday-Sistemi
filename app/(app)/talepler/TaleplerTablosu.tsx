"use client";

import { useMemo, useState } from "react";
import TalepRow from "./TalepRow";

const TALEP_TURU_ETIKET: Record<string, string> = { ISE_ALIM: "İşe Alım", ISTEN_CIKARMA: "İşten Çıkarma" };

export default function TaleplerTablosu({ talepler, benimKullaniciId, benimRolum }: {
  talepler: any[]; benimKullaniciId: string; benimRolum: string;
}) {
  const [kategoriFiltre, setKategoriFiltre] = useState<"AKTIF" | "PASIF" | "TUMU">("AKTIF");
  const [acanFiltre, setAcanFiltre] = useState("");
  const [turFiltre, setTurFiltre] = useState("");

  const acanListesi = useMemo(() => {
    const map = new Map<string, string>();
    talepler.forEach((t) => {
      if (t.acan_kullanici_id && t.acanAdi) map.set(t.acan_kullanici_id, t.acanAdi);
    });
    return Array.from(map.entries());
  }, [talepler]);

  const filtrelenmis = useMemo(() => {
    return talepler.filter((t) => {
      if (kategoriFiltre !== "TUMU" && t.kategori !== kategoriFiltre) return false;
      if (acanFiltre && t.acan_kullanici_id !== acanFiltre) return false;
      if (turFiltre && t.talep_turu !== turFiltre) return false;
      return true;
    });
  }, [talepler, kategoriFiltre, acanFiltre, turFiltre]);

  const aktifSayisi = talepler.filter((t) => t.kategori === "AKTIF").length;
  const pasifSayisi = talepler.filter((t) => t.kategori === "PASIF").length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => setKategoriFiltre("AKTIF")}
            className={`px-3 py-1.5 text-xs font-medium ${kategoriFiltre === "AKTIF" ? "bg-navy text-white" : "bg-white text-gray-600"}`}>
            Aktif ({aktifSayisi})
          </button>
          <button onClick={() => setKategoriFiltre("PASIF")}
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${kategoriFiltre === "PASIF" ? "bg-navy text-white" : "bg-white text-gray-600"}`}>
            Pasif ({pasifSayisi})
          </button>
          <button onClick={() => setKategoriFiltre("TUMU")}
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${kategoriFiltre === "TUMU" ? "bg-navy text-white" : "bg-white text-gray-600"}`}>
            Tümü ({talepler.length})
          </button>
        </div>

        <select value={acanFiltre} onChange={(e) => setAcanFiltre(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs">
          <option value="">Tüm Açanlar</option>
          {acanListesi.map(([id, ad]) => <option key={id} value={id}>{ad}</option>)}
        </select>

        <select value={turFiltre} onChange={(e) => setTurFiltre(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs">
          <option value="">Tüm Türler</option>
          {Object.entries(TALEP_TURU_ETIKET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
              <th className="text-left px-3 py-2">Talep No</th>
              <th className="text-left px-3 py-2">Tür</th>
              <th className="text-left px-3 py-2">Mağaza</th>
              <th className="text-left px-3 py-2">Açan</th>
              <th className="text-left px-3 py-2">Pozisyon</th>
              <th className="text-left px-3 py-2">Kişi</th>
              <th className="text-left px-3 py-2">Gönderim</th>
              <th className="text-left px-3 py-2">Durum</th>
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
              <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400 text-xs">Bu filtreye uyan talep yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
