"use client";

import { useEffect, useState } from "react";
import { getPersonelSayfa, getPerformansKisiSayfa, getPerformansMagazaSayfa } from "./actions";
import { personelTumunuSil, performansKisiTumunuSil, performansMagazaTumunuSil } from "../veri-aktarim/actions-silme";

type Sekme = "personel" | "performans_kisi" | "performans_magaza";
const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const SAYFA_BOYUTU = 50;

const SEKMELER: { key: Sekme; label: string; silFn: () => Promise<{ basarili: boolean; silinen: number; hata?: string }> }[] = [
  { key: "personel", label: "Personel", silFn: personelTumunuSil },
  { key: "performans_kisi", label: "Performans — Kişi Bazlı", silFn: performansKisiTumunuSil },
  { key: "performans_magaza", label: "Performans — Mağaza Bazlı", silFn: performansMagazaTumunuSil },
];

export default function VerilerTablosu({ yenilemeTetik }: { yenilemeTetik?: number } = {}) {
  const [sekme, setSekme] = useState<Sekme>("personel");
  const [arama, setArama] = useState("");
  const [aramaGecikmeli, setAramaGecikmeli] = useState("");
  const [sayfa, setSayfa] = useState(0);
  const [satirlar, setSatirlar] = useState<any[]>([]);
  const [toplam, setToplam] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);

  // Arama kutusuna her tuş vuruşunda sorgu atmamak için kısa bir gecikme.
  useEffect(() => {
    const t = setTimeout(() => setAramaGecikmeli(arama), 350);
    return () => clearTimeout(t);
  }, [arama]);

  useEffect(() => {
    setSayfa(0);
  }, [sekme, aramaGecikmeli]);

  const [silmeTetik, setSilmeTetik] = useState(0);

  useEffect(() => {
    setYukleniyor(true);
    const fn = sekme === "personel" ? getPersonelSayfa : sekme === "performans_kisi" ? getPerformansKisiSayfa : getPerformansMagazaSayfa;
    fn(sayfa, aramaGecikmeli).then((res) => {
      setSatirlar(res.satirlar);
      setToplam(res.toplam);
      setYukleniyor(false);
    });
  }, [sekme, sayfa, aramaGecikmeli, yenilemeTetik, silmeTetik]);

  const toplamSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));
  const aktifSekme = SEKMELER.find((s) => s.key === sekme)!;

  const [onayAcik, setOnayAcik] = useState(false);
  const [onayMetni, setOnayMetni] = useState("");
  const [siliniyor, setSiliniyor] = useState(false);
  const [silmeHata, setSilmeHata] = useState<string | null>(null);

  function silmeyiBaslat() {
    setOnayAcik(true);
    setOnayMetni("");
    setSilmeHata(null);
  }

  function silmeyiOnayla() {
    if (onayMetni.trim().toLocaleUpperCase("tr-TR") !== "SİL") return;
    setSiliniyor(true);
    aktifSekme.silFn().then((res) => {
      setSiliniyor(false);
      setOnayAcik(false);
      if (!res.basarili) {
        setSilmeHata(res.hata ?? "Silinemedi.");
        return;
      }
      setSayfa(0);
      setToplam(0);
      setSatirlar([]);
      setSilmeTetik((t) => t + 1);
    });
  }

  return (
    <div>
      <div className="flex gap-2 mb-3 items-center">
        {SEKMELER.map((s) => (
          <button
            key={s.key}
            onClick={() => setSekme(s.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${sekme === s.key ? "bg-navy text-white" : "bg-white border border-gray-200 text-gray-600"}`}
          >
            {s.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={silmeyiBaslat}
          className="px-3 py-1.5 rounded-md text-xs font-medium text-danger border border-danger/30 hover:bg-danger-bg"
        >
          Bu Verinin Tümünü Sil
        </button>
      </div>

      {silmeHata && <div className="text-[11px] text-danger mb-2">{silmeHata}</div>}

      {onayAcik && (
        <div className="bg-danger-bg border border-danger/30 rounded-md p-3 mb-3">
          <div className="text-xs text-danger font-medium mb-1">
            "{aktifSekme.label}" verisinin TAMAMINI ({toplam} kayıt) kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz.
          </div>
          <div className="text-[11px] text-gray-600 mb-2">Onaylamak için kutuya <b>SİL</b> yazın:</div>
          <div className="flex items-center gap-2">
            <input
              value={onayMetni}
              onChange={(e) => setOnayMetni(e.target.value)}
              placeholder="SİL"
              className="border border-danger/40 rounded-md px-2 py-1 text-xs w-32"
            />
            <button
              onClick={silmeyiOnayla}
              disabled={onayMetni.trim().toLocaleUpperCase("tr-TR") !== "SİL" || siliniyor}
              className="bg-danger text-white rounded-md px-3 py-1 text-xs font-medium disabled:opacity-40"
            >
              {siliniyor ? "Siliniyor..." : "Kalıcı Olarak Sil"}
            </button>
            <button onClick={() => setOnayAcik(false)} className="text-xs text-gray-400">Vazgeç</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder={sekme === "personel" ? "Ad, TC veya personel kodu ara..." : sekme === "performans_kisi" ? "Ad veya personel kodu ara..." : "Mağaza kodu/adı ara..."}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-64"
        />
        <div className="text-[11px] text-gray-400">{toplam} kayıt</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-card overflow-x-auto">
        {sekme === "personel" && (
          <table className="w-full text-xs min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
                <th className="text-left px-3 py-2">Personel Kodu</th>
                <th className="text-left px-3 py-2">TC Kimlik No</th>
                <th className="text-left px-3 py-2">Ad Soyad</th>
                <th className="text-left px-3 py-2">Ünvan</th>
                <th className="text-left px-3 py-2">Kategori</th>
                <th className="text-left px-3 py-2">Mağaza</th>
                <th className="text-left px-3 py-2">Durum</th>
                <th className="text-left px-3 py-2">Ort. HGO</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((p: any) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-gray-500">{p.personel_kodu ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{p.tc_kimlik_no}</td>
                  <td className="px-3 py-2 font-medium text-navy-3">{p.ad_soyad}</td>
                  <td className="px-3 py-2 text-gray-600">{p.guncel_unvan ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{p.kadro_kategorisi ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{p.magazalar?.magaza_adi ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.durum === "aktif" ? "bg-success-bg text-success" : "bg-gray-100 text-gray-500"}`}>
                      {p.durum}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-500">{p.performans_ortalama_hgo != null ? `%${p.performans_ortalama_hgo.toFixed(1)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sekme === "performans_kisi" && (
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
                <th className="text-left px-3 py-2">Personel Kodu</th>
                <th className="text-left px-3 py-2">Ad Soyad</th>
                <th className="text-left px-3 py-2">Ay/Yıl</th>
                <th className="text-left px-3 py-2">Hedef Ciro</th>
                <th className="text-left px-3 py-2">Gerçekleşen Ciro</th>
                <th className="text-left px-3 py-2">HGO</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s: any) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-gray-500">{s.personel?.personel_kodu ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-navy-3">{s.personel?.ad_soyad ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{AY_KISA[s.ay]} {s.yil}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{s.hedef_ciro_kdv_dahil?.toLocaleString("tr-TR")}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{s.gerceklesen_ciro_kdv_dahil?.toLocaleString("tr-TR")}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-navy-3">{s.hgo != null ? `%${s.hgo.toFixed(1)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sekme === "performans_magaza" && (
          <table className="w-full text-xs min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
                <th className="text-left px-3 py-2">Mağaza Kodu</th>
                <th className="text-left px-3 py-2">Mağaza Adı</th>
                <th className="text-left px-3 py-2">Ay/Yıl</th>
                <th className="text-left px-3 py-2">HGO</th>
                <th className="text-left px-3 py-2">Sepet Ort.</th>
                <th className="text-left px-3 py-2">Sepet Der.</th>
                <th className="text-left px-3 py-2">Dönüşüm</th>
                <th className="text-left px-3 py-2">Giren Müşteri</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s: any) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-gray-500">{s.magazalar?.magaza_kodu ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-navy-3">{s.magazalar?.magaza_adi ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{AY_KISA[s.ay]} {s.yil}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-navy-3">{s.hgo != null ? `%${s.hgo.toFixed(1)}` : "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{s.sepet_ortalamasi ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{s.sepet_derinligi ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{s.donusum_orani != null ? `%${(s.donusum_orani * 100).toFixed(1)}` : "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{s.giren_musteri_sayisi ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!yukleniyor && satirlar.length === 0 && (
          <div className="text-center text-gray-400 text-xs py-8">Kayıt bulunamadı.</div>
        )}
        {yukleniyor && (
          <div className="text-center text-gray-400 text-xs py-8">Yükleniyor...</div>
        )}
      </div>

      {toplamSayfa > 1 && (
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setSayfa((s) => Math.max(0, s - 1))}
            disabled={sayfa === 0}
            className="text-xs text-info disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            ← Önceki
          </button>
          <div className="text-[11px] text-gray-400">Sayfa {sayfa + 1} / {toplamSayfa}</div>
          <button
            onClick={() => setSayfa((s) => Math.min(toplamSayfa - 1, s + 1))}
            disabled={sayfa >= toplamSayfa - 1}
            className="text-xs text-info disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            Sonraki →
          </button>
        </div>
      )}
    </div>
  );
}
