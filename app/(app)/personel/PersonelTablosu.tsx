"use client";

import { useMemo, useState } from "react";

type Satir = {
  id: string;
  ad_soyad: string;
  guncel_unvan: string;
  kadro_kategorisi: string;
  durum: string;
  kidem_ay: number | null;
  performans_ortalama_hgo: number | null;
  magaza_adi: string;
  bolge_adi: string;
};

const KATEGORI_LABEL: Record<string, string> = {
  ANA_KADRO: "Ana Kadro",
  DONEMSEL: "Dönemsel",
  PART_TIME: "Part Time",
  HARIC: "Hariç",
  KATEGORISIZ: "Kategorisiz",
};

export default function PersonelTablosu({ satirlar }: { satirlar: Satir[] }) {
  const [arama, setArama] = useState("");
  const [bolgeFiltre, setBolgeFiltre] = useState("");
  const [durumFiltre, setDurumFiltre] = useState<"aktif" | "tumu">("aktif");

  const bolgeler = useMemo(
    () => Array.from(new Set(satirlar.map((s) => s.bolge_adi).filter(Boolean))).sort(),
    [satirlar]
  );

  const filtrelenmis = useMemo(() => {
    return satirlar.filter((s) => {
      if (durumFiltre === "aktif" && s.durum !== "aktif") return false;
      if (bolgeFiltre && s.bolge_adi !== bolgeFiltre) return false;
      if (arama) {
        const q = arama.toLocaleLowerCase("tr-TR");
        if (
          !s.ad_soyad.toLocaleLowerCase("tr-TR").includes(q) &&
          !s.guncel_unvan.toLocaleLowerCase("tr-TR").includes(q) &&
          !s.magaza_adi.toLocaleLowerCase("tr-TR").includes(q)
        ) return false;
      }
      return true;
    });
  }, [satirlar, bolgeFiltre, arama, durumFiltre]);

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <select value={durumFiltre} onChange={(e) => setDurumFiltre(e.target.value as "aktif" | "tumu")}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs">
          <option value="aktif">Sadece Aktif</option>
          <option value="tumu">Tümü (Pasif dahil)</option>
        </select>
        <select value={bolgeFiltre} onChange={(e) => setBolgeFiltre(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs">
          <option value="">Tüm Bölgeler (yetkiniz dahilinde)</option>
          {bolgeler.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <input value={arama} onChange={(e) => setArama(e.target.value)}
          placeholder="İsim / unvan / mağaza ara..."
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1 max-w-xs" />
      </div>

      <div className="bg-white border border-gray-200 rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase tracking-wide">
              <th className="text-left p-3">Ad Soyad</th>
              <th className="text-left p-3">Ünvan</th>
              <th className="text-left p-3">Kategori</th>
              <th className="text-left p-3">Mağaza</th>
              <th className="text-left p-3">Bölge</th>
              <th className="text-left p-3">Kıdem (Ay)</th>
              <th className="text-left p-3">Ort. HGO</th>
              <th className="text-left p-3">Durum</th>
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-400 text-xs">
                  Yetkiniz dahilinde gösterilecek personel bulunamadı.
                </td>
              </tr>
            )}
            {filtrelenmis.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="p-3 font-medium text-navy-3">{s.ad_soyad}</td>
                <td className="p-3 text-xs text-gray-600">{s.guncel_unvan || "—"}</td>
                <td className="p-3 text-xs text-gray-500">{KATEGORI_LABEL[s.kadro_kategorisi] ?? "—"}</td>
                <td className="p-3 text-xs text-gray-600">{s.magaza_adi || "—"}</td>
                <td className="p-3 text-xs text-gray-500">{s.bolge_adi || "—"}</td>
                <td className="p-3 text-xs text-gray-500">{s.kidem_ay ?? "—"}</td>
                <td className="p-3 text-xs text-gray-500">
                  {s.performans_ortalama_hgo != null ? `%${s.performans_ortalama_hgo.toFixed(0)}` : "—"}
                </td>
                <td className="p-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    s.durum === "aktif" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {s.durum === "aktif" ? "Aktif" : "Pasif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
