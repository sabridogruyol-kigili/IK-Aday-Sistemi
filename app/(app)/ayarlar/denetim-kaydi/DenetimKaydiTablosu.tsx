"use client";

import { useEffect, useState } from "react";
import { getDenetimKaydi, type DenetimKaydiSatiri } from "./actions";
import { HASSAS_ALANLAR, HASSAS_ALAN_ETIKET } from "@/lib/hassasVeri";

const SAYFA_BOYUTU = 50;

export default function DenetimKaydiTablosu() {
  const [satirlar, setSatirlar] = useState<DenetimKaydiSatiri[]>([]);
  const [toplam, setToplam] = useState(0);
  const [sayfa, setSayfa] = useState(0);
  const [arama, setArama] = useState("");
  const [aramaGecikmeli, setAramaGecikmeli] = useState("");
  const [alanFiltre, setAlanFiltre] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setAramaGecikmeli(arama), 300);
    return () => clearTimeout(t);
  }, [arama]);

  useEffect(() => { setSayfa(0); }, [aramaGecikmeli, alanFiltre]);

  useEffect(() => {
    setYukleniyor(true);
    getDenetimKaydi({ sayfa, arama: aramaGecikmeli || undefined, alan: alanFiltre || undefined }).then((r) => {
      setSatirlar(r.satirlar);
      setToplam(r.toplam);
      setYukleniyor(false);
    });
  }, [sayfa, aramaGecikmeli, alanFiltre]);

  const toplamSayfa = Math.max(Math.ceil(toplam / SAYFA_BOYUTU), 1);

  return (
    <div>
      <div className="text-xs text-gray-400 mb-3">
        Hassas bilgilerin ("Göster" tıklanarak) kim tarafından, ne zaman görüntülendiğinin kaydı.
      </div>
      <div className="flex items-center gap-2 mb-2">
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Kullanıcı adı ara..."
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-56"
        />
        <select value={alanFiltre} onChange={(e) => setAlanFiltre(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
          <option value="">Tüm Alanlar</option>
          {HASSAS_ALANLAR.map((a) => <option key={a} value={a}>{HASSAS_ALAN_ETIKET[a]}</option>)}
        </select>
        <div className="text-[11px] text-gray-400">{toplam} kayıt</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
              <th className="text-left px-3 py-2">Kullanıcı</th>
              <th className="text-left px-3 py-2">Rol</th>
              <th className="text-left px-3 py-2">Görüntülenen Bilgi</th>
              <th className="text-left px-3 py-2">Kayıt Türü</th>
              <th className="text-left px-3 py-2">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {yukleniyor ? (
              <tr><td colSpan={5} className="text-center text-xs text-gray-400 py-8">Yükleniyor...</td></tr>
            ) : satirlar.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-xs text-gray-400 py-8">Kayıt yok.</td></tr>
            ) : (
              satirlar.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-navy-3">{s.kullanici_ad_soyad ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{s.rol ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{s.alan_etiket}</td>
                  <td className="px-3 py-2 text-gray-400 text-[11px]">{s.hedef_tablo ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-400 text-[11px]">{new Date(s.created_at).toLocaleString("tr-TR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {toplamSayfa > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button disabled={sayfa === 0} onClick={() => setSayfa((s) => s - 1)} className="text-xs px-2 py-1 border border-gray-200 rounded-md disabled:opacity-40">◀</button>
          <span className="text-xs text-gray-400">{sayfa + 1} / {toplamSayfa}</span>
          <button disabled={sayfa >= toplamSayfa - 1} onClick={() => setSayfa((s) => s + 1)} className="text-xs px-2 py-1 border border-gray-200 rounded-md disabled:opacity-40">▶</button>
        </div>
      )}
    </div>
  );
}
