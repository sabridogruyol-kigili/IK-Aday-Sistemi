"use client";

import KisiGrafikPaneli from "../talepler/yeni/KisiGrafikPaneli";
import type { PersonelDetay } from "../talepler/yeni/actions-cikarma";
import type { PersonelAylikHgo } from "../talepler/yeni/actions-cikarma";

function Alan({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase">{label}</div>
      <div className="text-[13px] text-navy-3">{value}</div>
    </div>
  );
}

export default function BenimPerformansimIcerik({
  detay, gecmis, adSoyad,
}: {
  detay: PersonelDetay | null; gecmis: PersonelAylikHgo[]; adSoyad: string;
}) {
  const ortalamaHgo = gecmis.filter((g) => g.hgo != null).length > 0
    ? gecmis.reduce((s, g) => s + (g.hgo ?? 0), 0) / gecmis.filter((g) => g.hgo != null).length
    : null;
  const hgoYuksek = ortalamaHgo !== null && ortalamaHgo >= 80;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Özlük Bilgileri</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Alan label="Ad Soyad" value={adSoyad} />
          <Alan label="Kıdem" value={detay?.kidem_ay != null ? `${Math.floor(detay.kidem_ay / 12)} yıl ${detay.kidem_ay % 12} ay` : "—"} />
          <Alan label="Görev Yeri (İl)" value={detay?.il_adi ?? "—"} />
          <Alan label="İşe Giriş Tarihi" value={detay?.ise_giris_tarihi ? new Date(detay.ise_giris_tarihi).toLocaleDateString("tr-TR") : "—"} />
          <Alan label="Doğum Tarihi" value={detay?.dogum_tarihi ? new Date(detay.dogum_tarihi).toLocaleDateString("tr-TR") : "—"} />
          <Alan label="Kan Grubu" value={detay?.kan_grubu_kodu ?? "—"} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Aylık HGO (Ciro)</div>
        <KisiGrafikPaneli gecmis={gecmis} yukleniyor={false} varsayilanDegisken="hgo" hgoYuksek={hgoYuksek} />
      </div>

      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Aylık HGO (Adet)</div>
        <KisiGrafikPaneli gecmis={gecmis} yukleniyor={false} varsayilanDegisken="adet_hgo" hgoYuksek={hgoYuksek} />
      </div>
    </div>
  );
}
