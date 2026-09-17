"use client";

import { useState, useTransition } from "react";
import { alanGorunurlukGuncelle, type AlanGorunurlukAyari } from "./actions-alan-gorunurluk";
import { HASSAS_ALANLAR, HASSAS_ALAN_ETIKET, KISITLANABILIR_ROLLER } from "@/lib/hassasVeri";

const ROL_ETIKET: Record<string, string> = {
  BM: "BM", IK: "İK", MAGAZALAR_DIREKTORLUGU: "Mağazalar Direktörlüğü", BORDRO: "Bordro", CALISAN: "Çalışan",
};

// Rol bazlı hassas alan görünürlüğü — kullanıcı bazlı DEĞİL, rol bazlı.
// Yönetim burada listelenmez çünkü Yönetim her zaman tüm alanları görür,
// kendi kendini kısıtlayamaz.
export default function BilgiYetkileriTablosu({ ayarlar }: { ayarlar: AlanGorunurlukAyari[] }) {
  const [yerel, setYerel] = useState(ayarlar);
  const [pending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  function gorebilirMi(rol: string, alan: string) {
    return yerel.find((a) => a.rol === rol && a.alan === alan)?.gorebilir ?? true;
  }

  function toggle(rol: string, alan: (typeof HASSAS_ALANLAR)[number]) {
    const yeniDeger = !gorebilirMi(rol, alan);
    setYerel((prev) => prev.map((a) => (a.rol === rol && a.alan === alan ? { ...a, gorebilir: yeniDeger } : a)));
    setHata(null);
    startTransition(async () => {
      const sonuc = await alanGorunurlukGuncelle(rol, alan, yeniDeger);
      if (sonuc?.error) {
        setHata(sonuc.error);
        // başarısızsa geri al
        setYerel((prev) => prev.map((a) => (a.rol === rol && a.alan === alan ? { ...a, gorebilir: !yeniDeger } : a)));
      }
    });
  }

  return (
    <div>
      <div className="text-[11px] text-gray-400 mb-3">
        İşaretli kutular o rolün ilgili bilgiyi görebileceği anlamına gelir. Yönetim her zaman tüm bilgileri görür.
        {pending && <span className="text-info ml-2">Kaydediliyor…</span>}
      </div>
      {hata && <div className="text-[11px] text-danger bg-danger-bg rounded-md px-2.5 py-1.5 mb-3">{hata}</div>}
      <table className="text-sm">
        <thead>
          <tr className="text-[10px] text-gray-400 uppercase border-b border-gray-200">
            <th className="text-left px-3 py-2">Bilgi</th>
            {KISITLANABILIR_ROLLER.map((rol) => (
              <th key={rol} className="text-center px-4 py-2">{ROL_ETIKET[rol]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HASSAS_ALANLAR.map((alan) => (
            <tr key={alan} className="border-t border-gray-100">
              <td className="px-3 py-2 text-navy-3">{HASSAS_ALAN_ETIKET[alan]}</td>
              {KISITLANABILIR_ROLLER.map((rol) => (
                <td key={rol} className="text-center px-4 py-2">
                  <input
                    type="checkbox"
                    checked={gorebilirMi(rol, alan)}
                    onChange={() => toggle(rol, alan)}
                    className="w-4 h-4"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
