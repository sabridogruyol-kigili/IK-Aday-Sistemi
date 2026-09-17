"use client";

import { useState } from "react";
import { hassasAlanGetir } from "@/app/(app)/personel/actions-hassas";
import type { HassasAlan } from "@/lib/hassasVeri";

// TC/telefon/doğum tarihi/kan grubu gibi hassas alanları varsayılan olarak
// göstermez; "👁" tıklanınca sunucudan anlık getirir (ve o erişim denetim
// kaydına düşer). Rol bu alanı görmeye yetkili değilse buton hiç çıkmaz,
// kilit ikonu gösterilir.
export default function HassasAlanGoster({
  hedefTablo, hedefId, alan, gorebilir, placeholder = "••••••••••",
}: {
  hedefTablo: "personel" | "adaylar" | "olumsuz_referans_listesi";
  hedefId: string;
  alan: HassasAlan;
  gorebilir: boolean;
  placeholder?: string;
}) {
  const [deger, setDeger] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function goster() {
    setYukleniyor(true);
    setHata(null);
    const sonuc = await hassasAlanGetir(hedefTablo, hedefId, alan);
    setYukleniyor(false);
    if (sonuc.error) { setHata(sonuc.error); return; }
    setDeger(sonuc.deger ?? "—");
  }

  if (!gorebilir) {
    return <span className="text-gray-300 text-[11px]" title="Bu bilgiyi görüntüleme yetkiniz yok">🔒 Kısıtlı</span>;
  }

  if (hata) return <span className="text-danger text-[10px]">{hata}</span>;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono">{deger ?? placeholder}</span>
      <button
        type="button"
        onClick={() => (deger !== null ? setDeger(null) : goster())}
        disabled={yukleniyor}
        title={deger !== null ? "Gizle" : "Göster"}
        className="text-gray-400 hover:text-navy text-[10px] leading-none shrink-0"
      >
        {yukleniyor ? "…" : deger !== null ? "🙈" : "👁"}
      </button>
    </span>
  );
}
