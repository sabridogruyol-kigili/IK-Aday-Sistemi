"use client";

import KisiGrafikPaneli from "../talepler/yeni/KisiGrafikPaneli";
import type { PersonelDetay } from "../talepler/yeni/actions-cikarma";
import type { PersonelAylikHgo, KisiPerformansOrtalama } from "../talepler/yeni/actions-cikarma";
import HassasAlanGoster from "@/lib/HassasAlanGoster";
import BedenOlculeriFormu from "./BedenOlculeriFormu";
import type { BedenOlculeri } from "./actions-beden";

function Alan({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase">{label}</div>
      <div className="text-[13px] text-navy-3">{value}</div>
    </div>
  );
}

function HassasAlan({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase">{label}</div>
      <div className="text-[13px] text-navy-3">{children}</div>
    </div>
  );
}

export default function BenimPerformansimIcerik({
  personelId, detay, gecmis, adSoyad, sirketOrtalamasi, bedenOlculeri,
}: {
  personelId: string; detay: PersonelDetay | null; gecmis: PersonelAylikHgo[]; adSoyad: string; sirketOrtalamasi: KisiPerformansOrtalama[];
  bedenOlculeri: BedenOlculeri | null;
}) {
  const ortalamaHgo = gecmis.filter((g) => g.hgo != null).length > 0
    ? gecmis.reduce((s, g) => s + (g.hgo ?? 0), 0) / gecmis.filter((g) => g.hgo != null).length
    : null;
  const hgoYuksek = ortalamaHgo !== null && ortalamaHgo >= 80;

  return (
    <div className="space-y-4">
      <BedenOlculeriFormu mevcut={bedenOlculeri} />

      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Özlük Bilgileri</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Alan label="Ad Soyad" value={adSoyad} />
          <Alan label="Kıdem" value={detay?.kidem_ay != null ? `${Math.floor(detay.kidem_ay / 12)} yıl ${detay.kidem_ay % 12} ay` : "—"} />
          <Alan label="Görev Yeri (İl)" value={detay?.il_adi ?? "—"} />
          <Alan label="İşe Giriş Tarihi" value={detay?.ise_giris_tarihi ? new Date(detay.ise_giris_tarihi).toLocaleDateString("tr-TR") : "—"} />
          <HassasAlan label="Doğum Tarihi">
            <HassasAlanGoster hedefTablo="personel" hedefId={personelId} alan="dogum_tarihi" gorebilir={detay?.gorunurlukler.dogum_tarihi ?? false} placeholder="••.••.••••" />
          </HassasAlan>
          <HassasAlan label="Kan Grubu">
            <HassasAlanGoster hedefTablo="personel" hedefId={personelId} alan="kan_grubu_kodu" gorebilir={detay?.gorunurlukler.kan_grubu_kodu ?? false} placeholder="••" />
          </HassasAlan>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Aylık HGO (Ciro)</div>
        <KisiGrafikPaneli gecmis={gecmis} yukleniyor={false} varsayilanDegisken="hgo" hgoYuksek={hgoYuksek} sirketOrtalamasi={sirketOrtalamasi} />
      </div>

      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Aylık HGO (Adet)</div>
        <KisiGrafikPaneli gecmis={gecmis} yukleniyor={false} varsayilanDegisken="adet_hgo" hgoYuksek={hgoYuksek} sirketOrtalamasi={sirketOrtalamasi} />
      </div>
    </div>
  );
}
