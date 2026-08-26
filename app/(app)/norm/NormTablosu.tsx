"use client";

import { useMemo, useState } from "react";

type Satir = {
  id: string;
  magaza_kodu: string;
  magaza_adi: string;
  bolge_adi: string;
  ana_kadro_norm: number;
  ana_kadro_dolu: number;
  donemsel_norm: number;
  donemsel_dolu: number;
  part_time_norm: number;
  part_time_dolu: number;
  toplam_norm: number;
  toplam_dolu: number;
};

function DolulukHucre({ dolu, norm }: { dolu: number; norm: number }) {
  const asildi = dolu > norm;
  const dolu100 = norm > 0 && dolu >= norm;
  return (
    <span className={asildi ? "text-danger font-semibold" : dolu100 ? "text-navy-3 font-semibold" : "text-gray-600"}>
      {dolu} / {norm}
    </span>
  );
}

export default function NormTablosu({ satirlar }: { satirlar: Satir[] }) {
  const [arama, setArama] = useState("");
  const [bolgeFiltre, setBolgeFiltre] = useState("");

  const bolgeler = useMemo(
    () => Array.from(new Set(satirlar.map((s) => s.bolge_adi).filter(Boolean))).sort(),
    [satirlar]
  );

  const filtrelenmis = useMemo(() => {
    return satirlar.filter((s) => {
      if (bolgeFiltre && s.bolge_adi !== bolgeFiltre) return false;
      if (arama) {
        const q = arama.toLocaleLowerCase("tr-TR");
        if (
          !s.magaza_adi.toLocaleLowerCase("tr-TR").includes(q) &&
          !s.magaza_kodu.toLocaleLowerCase("tr-TR").includes(q)
        ) return false;
      }
      return true;
    });
  }, [satirlar, bolgeFiltre, arama]);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <select value={bolgeFiltre} onChange={(e) => setBolgeFiltre(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs">
          <option value="">Tüm Bölgeler (yetkiniz dahilinde)</option>
          {bolgeler.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <input value={arama} onChange={(e) => setArama(e.target.value)}
          placeholder="Mağaza adı / kodu ara..."
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1 max-w-xs" />
      </div>

      <div className="bg-white border border-gray-200 rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase tracking-wide">
              <th className="text-left p-3">Mağaza Kodu</th>
              <th className="text-left p-3">Mağaza Adı</th>
              <th className="text-left p-3">Bölge</th>
              <th className="text-left p-3">Ana Kadro</th>
              <th className="text-left p-3">Dönemsel</th>
              <th className="text-left p-3">Part-Time</th>
              <th className="text-left p-3">Toplam Dolu / Norm</th>
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400 text-xs">
                  Yetkiniz dahilinde gösterilecek mağaza bulunamadı.
                </td>
              </tr>
            )}
            {filtrelenmis.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="p-3 text-xs text-gray-500">{s.magaza_kodu}</td>
                <td className="p-3 font-medium text-navy-3">{s.magaza_adi}</td>
                <td className="p-3 text-xs text-gray-500">{s.bolge_adi}</td>
                <td className="p-3"><DolulukHucre dolu={s.ana_kadro_dolu} norm={s.ana_kadro_norm} /></td>
                <td className="p-3"><DolulukHucre dolu={s.donemsel_dolu} norm={s.donemsel_norm} /></td>
                <td className="p-3"><DolulukHucre dolu={s.part_time_dolu} norm={s.part_time_norm} /></td>
                <td className="p-3"><DolulukHucre dolu={s.toplam_dolu} norm={s.toplam_norm} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
