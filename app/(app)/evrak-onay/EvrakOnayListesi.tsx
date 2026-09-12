"use client";

import { useMemo, useState } from "react";
import EvrakOnayDetay from "./EvrakOnayDetay";

type Kisi = { personelId: string; adSoyad: string; unvan: string; magaza: string; tamamlanan: number; toplam: number; durumEtiket: string };

const DURUM_RENK: Record<string, string> = {
  "Tamamlandı": "bg-success-bg text-success",
  "Eksik/Reddedilen Var": "bg-danger-bg text-danger",
  "İncelemede": "bg-accent/15 text-accent",
  "İşe Alım Onaylandı — Evrak Bekleniyor": "bg-gray-100 text-gray-500",
};

export default function EvrakOnayListesi({ kisiler }: { kisiler: Kisi[] }) {
  const [arama, setArama] = useState("");
  const [durumFiltre, setDurumFiltre] = useState("");
  const [secili, setSecili] = useState<Kisi | null>(null);

  const filtrelenmis = useMemo(() => {
    return kisiler.filter((k) => {
      if (durumFiltre && k.durumEtiket !== durumFiltre) return false;
      if (arama) {
        const q = arama.toLocaleLowerCase("tr-TR");
        if (!k.adSoyad.toLocaleLowerCase("tr-TR").includes(q) && !k.magaza.toLocaleLowerCase("tr-TR").includes(q)) return false;
      }
      return true;
    });
  }, [kisiler, arama, durumFiltre]);

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Evrak Onay</div>
        <div className="text-xs text-gray-400 mt-0.5">İşe alınan kişilerin giriş evrak süreçleri — belge bazında inceleyip onaylayın/reddedin.</div>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-card p-3 mb-4">
        <input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="İsim veya mağaza ara..."
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1 max-w-xs" />
        <select value={durumFiltre} onChange={(e) => setDurumFiltre(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
          <option value="">Tüm Durumlar</option>
          <option value="İşe Alım Onaylandı — Evrak Bekleniyor">Evrak Bekleniyor</option>
          <option value="İncelemede">İncelemede</option>
          <option value="Eksik/Reddedilen Var">Eksik/Reddedilen Var</option>
          <option value="Tamamlandı">Tamamlandı</option>
        </select>
        <div className="text-[11px] text-gray-400 ml-auto">{filtrelenmis.length} / {kisiler.length} kişi</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-navy-3/70 uppercase border-b-2 border-navy">
              <th className="text-left px-3 py-2"></th>
              <th className="text-left px-3 py-2">Ad Soyad</th>
              <th className="text-left px-3 py-2">Ünvan</th>
              <th className="text-left px-3 py-2">Mağaza</th>
              <th className="text-left px-3 py-2">Belge</th>
              <th className="text-left px-3 py-2">Durum</th>
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.map((k) => (
              <tr key={k.personelId} className="border-t border-gray-100">
                <td className="p-3">
                  <button onClick={() => setSecili(k)}
                    className="text-[10px] bg-white border border-gray-300 text-gray-600 rounded-md px-2 py-1 hover:bg-gray-50 hover:border-navy hover:text-navy transition-colors">
                    Detay
                  </button>
                </td>
                <td className="p-3 font-medium text-navy-3">{k.adSoyad}</td>
                <td className="p-3 text-xs text-gray-500">{k.unvan}</td>
                <td className="p-3 text-xs text-gray-500">{k.magaza}</td>
                <td className="p-3 text-xs font-mono text-gray-600">{k.tamamlanan} / {k.toplam}</td>
                <td className="p-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DURUM_RENK[k.durumEtiket] ?? "bg-gray-100 text-gray-500"}`}>
                    {k.durumEtiket}
                  </span>
                </td>
              </tr>
            ))}
            {filtrelenmis.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400 text-xs">Görüntülenecek kişi yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {secili && <EvrakOnayDetay personelId={secili.personelId} adSoyad={secili.adSoyad} onClose={() => setSecili(null)} />}
    </div>
  );
}
