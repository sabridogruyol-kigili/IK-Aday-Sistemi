"use client";

import { useState, useTransition } from "react";
import { karaListeOnayla, karaListeReddet, type KaraListeKaydi } from "./actions";
import KaraListeyeEkleModal from "./KaraListeyeEkleModal";

const DURUM_ETIKET: Record<string, string> = {
  AKTIF: "Kara Listede", ONAY_BEKLIYOR: "Onay Bekliyor", REDDEDILDI: "Reddedildi",
};
const DURUM_RENK: Record<string, string> = {
  AKTIF: "bg-danger-bg text-danger", ONAY_BEKLIYOR: "bg-accent/10 text-accent", REDDEDILDI: "bg-gray-100 text-gray-500",
};

export default function KaraListeTablosu({ kayitlar, rol }: { kayitlar: KaraListeKaydi[]; rol: string }) {
  const [durumFiltre, setDurumFiltre] = useState<"" | "AKTIF" | "ONAY_BEKLIYOR" | "REDDEDILDI">("");
  const [aramaMetni, setAramaMetni] = useState("");
  const [ekleModalAcik, setEkleModalAcik] = useState(false);
  const [pending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  const filtrelenmis = kayitlar.filter((k) => {
    if (durumFiltre && k.durum !== durumFiltre) return false;
    if (aramaMetni) {
      const q = aramaMetni.toLocaleLowerCase("tr-TR");
      if (!`${k.ad_soyad} ${k.tc_kimlik_no}`.toLocaleLowerCase("tr-TR").includes(q)) return false;
    }
    return true;
  });

  function onayla(id: string) {
    setHata(null);
    startTransition(async () => {
      const sonuc = await karaListeOnayla(id);
      if (sonuc?.error) setHata(sonuc.error);
    });
  }
  function reddet(id: string) {
    setHata(null);
    startTransition(async () => {
      const sonuc = await karaListeReddet(id);
      if (sonuc?.error) setHata(sonuc.error);
    });
  }

  const yonetimMi = rol === "YONETIM";

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <input
            value={aramaMetni}
            onChange={(e) => setAramaMetni(e.target.value)}
            placeholder="Ad soyad / TC ara..."
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-44"
          />
          <select
            value={durumFiltre}
            onChange={(e) => setDurumFiltre(e.target.value as any)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
          >
            <option value="">Tüm Durumlar</option>
            <option value="AKTIF">Kara Listede</option>
            <option value="ONAY_BEKLIYOR">Onay Bekliyor</option>
            <option value="REDDEDILDI">Reddedildi</option>
          </select>
          <span className="text-[11px] text-gray-400">{filtrelenmis.length} kayıt</span>
        </div>
        <button
          onClick={() => setEkleModalAcik(true)}
          className="bg-navy text-white rounded-md px-3 py-1.5 text-xs font-medium"
        >
          + Kara Listeye Ekle
        </button>
      </div>

      {hata && <div className="text-xs text-danger bg-danger-bg rounded-md px-2.5 py-1.5 mb-3">{hata}</div>}

      {filtrelenmis.length === 0 ? (
        <div className="text-xs text-gray-400 py-8 text-center">Bu filtreye uyan kayıt yok.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-gray-400 uppercase border-b border-gray-200">
                <th className="text-left p-2">TC Kimlik No</th>
                <th className="text-left p-2">Ad Soyad</th>
                <th className="text-left p-2">Açıklama</th>
                <th className="text-left p-2">Durum</th>
                <th className="text-left p-2">Ekleyen</th>
                <th className="text-left p-2">Tarih</th>
                {yonetimMi && <th className="text-right p-2">İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {filtrelenmis.map((k) => (
                <tr key={k.id} className="border-t border-gray-100">
                  <td className="p-2 font-mono text-navy-3">{k.tc_kimlik_no}</td>
                  <td className="p-2 text-navy-3 font-medium">{k.ad_soyad}</td>
                  <td className="p-2 text-gray-600 max-w-xs truncate" title={k.aciklama}>{k.aciklama}</td>
                  <td className="p-2">
                    <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${DURUM_RENK[k.durum]}`}>
                      {DURUM_ETIKET[k.durum]}
                    </span>
                  </td>
                  <td className="p-2 text-gray-500">
                    {k.ekleyen_ad_soyad ?? "—"} <span className="text-[9px] text-gray-400">({k.ekleyen_rol})</span>
                  </td>
                  <td className="p-2 text-gray-400 text-[11px]">{new Date(k.created_at).toLocaleDateString("tr-TR")}</td>
                  {yonetimMi && (
                    <td className="p-2 text-right">
                      {k.durum === "ONAY_BEKLIYOR" && (
                        <div className="flex items-center gap-1.5 justify-end">
                          <button disabled={pending} onClick={() => onayla(k.id)}
                            className="text-[11px] font-medium bg-success text-white rounded-md px-2 py-1 disabled:opacity-50">
                            Onayla
                          </button>
                          <button disabled={pending} onClick={() => reddet(k.id)}
                            className="text-[11px] font-medium bg-white border border-danger/40 text-danger rounded-md px-2 py-1 disabled:opacity-50">
                            Reddet
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ekleModalAcik && <KaraListeyeEkleModal onClose={() => setEkleModalAcik(false)} />}
    </div>
  );
}
