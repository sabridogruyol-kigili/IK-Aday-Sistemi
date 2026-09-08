"use client";

import { useState } from "react";
import ImportForm from "./ImportForm";
import VerilerTablosu from "../veriler/VerilerTablosu";
import BolgeYonetimi from "../magazalar/BolgeYonetimi";
import MagazaTablosu from "../magazalar/MagazaTablosu";
import { magazalarTumunuSil } from "./actions-silme";

type Bolge = { id: string; ad: string };
type Magaza = {
  id: string; magaza_kodu: string; magaza_adi: string; bolge_id: string | null;
  subetipi: string | null; net_m2: number | null; aktif: boolean;
  ana_kadro_norm: number; donemsel_norm: number; part_time_norm: number;
};

export default function VeriYonetimi({ bolgeler, magazalar }: { bolgeler: Bolge[]; magazalar: Magaza[] }) {
  const [yenilemeSayaci, setYenilemeSayaci] = useState(0);

  const [onayAcik, setOnayAcik] = useState(false);
  const [onayMetni, setOnayMetni] = useState("");
  const [siliniyor, setSiliniyor] = useState(false);
  const [silmeHata, setSilmeHata] = useState<string | null>(null);
  const [silmeSonucu, setSilmeSonucu] = useState<string | null>(null);

  function silmeyiOnayla() {
    if (onayMetni.trim().toLocaleUpperCase("tr-TR") !== "SİL") return;
    setSiliniyor(true);
    magazalarTumunuSil().then((res) => {
      setSiliniyor(false);
      setOnayAcik(false);
      if (!res.basarili) {
        setSilmeHata(res.hata ?? "Silinemedi.");
        return;
      }
      setSilmeSonucu(`${res.silinen} mağaza silindi.`);
      setYenilemeSayaci((c) => c + 1);
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-info-bg border border-info/30 rounded-md p-3">
        <div className="text-xs font-semibold text-info mb-1.5">Önerilen İçe Aktarım Sırası</div>
        <ol className="text-[11px] text-gray-600 space-y-1 list-decimal list-inside">
          <li><b>Mağaza Performans</b> — mağazaları ve bölgeleri oluşturur, diğer tüm importlar buna bağlı.</li>
          <li><b>Çalışan Performans</b> — mağaza koduna göre eşleşir, sicili sistemde yoksa geçici personel oluşturur.</li>
          <li><b>Turnover</b> — mağaza koduna göre eşleşir.</li>
          <li><b>Personel</b> — mağaza koduna göre eşleşir; Çalışan Performans'ın oluşturduğu geçici kayıtları gerçek bilgiyle günceller.</li>
          <li><b>Mağaza / Bölge / Norm</b> — en sona bırakılması önerilir; mağazalar zaten var olduğu için bölgelerine dokunmaz, sadece kadro sayılarını ekler.</li>
        </ol>
        <div className="text-[10px] text-gray-400 mt-1.5">
          Bu sıra dışında da yükleyebilirsiniz — sistem eksik mağaza gibi durumlarda hangi dosyayı önce yüklemeniz gerektiğini hata mesajında belirtir.
        </div>
      </div>

      <ImportForm onBasarili={() => setYenilemeSayaci((c) => c + 1)} />

      <div>
        <div className="text-sm font-semibold text-navy-3 mb-1">İçe Aktarılan Veriler</div>
        <div className="text-[11px] text-gray-400 mb-3">
          Yukarıda bir import tamamlandığında bu tablo otomatik güncellenir.
        </div>
        <VerilerTablosu yenilemeTetik={yenilemeSayaci} />
      </div>

      <div className="pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between mb-1 mt-5">
          <div className="text-sm font-semibold text-navy-3">Mağazalar / Bölgeler / Normlar</div>
          <button
            onClick={() => { setOnayAcik(true); setOnayMetni(""); setSilmeHata(null); setSilmeSonucu(null); }}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-danger border border-danger/30 hover:bg-danger-bg"
          >
            Tüm Mağazaları Sil
          </button>
        </div>
        <div className="text-[11px] text-gray-400 mb-3">
          Mağaza sildiğinizde (tekil "Pasif Yap" hariç), ilişkili norm ve performans kayıtları da silinir; personel ve talepler silinmez, sadece mağaza bağlantıları temizlenir.
        </div>

        {silmeHata && <div className="text-[11px] text-danger mb-2">{silmeHata}</div>}
        {silmeSonucu && <div className="text-[11px] text-success mb-2">{silmeSonucu}</div>}

        {onayAcik && (
          <div className="bg-danger-bg border border-danger/30 rounded-md p-3 mb-3">
            <div className="text-xs text-danger font-medium mb-1">
              Sistemdeki TÜM mağazaları ({magazalar.length} adet) ve bağlı norm/performans kayıtlarını kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz.
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

        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-navy-3 mb-1">Bölgeler</div>
            <BolgeYonetimi bolgeler={bolgeler} />
          </div>

          <div>
            <div className="text-xs font-semibold text-navy-3 mb-1">Mağazalar ve Norm Değerleri</div>
            <MagazaTablosu magazalar={magazalar} bolgeler={bolgeler} />
          </div>
        </div>
      </div>
    </div>
  );
}
