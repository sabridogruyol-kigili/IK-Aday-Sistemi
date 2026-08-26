import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RaporlarClient from "./RaporlarClient";

export default async function RaporlarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS zaten bölge bazlı kısıtlıyor — BM/İK sadece kendi kapsamındaki veriyi görür, ek filtre gerekmez.

  // 1) Norm doluluk (mağaza bazlı, kategori toplamı)
  const { data: magazalarHam } = await supabase
    .from("magazalar")
    .select("id, magaza_adi, magaza_kodu, bolge_id, bolgeler(ad)")
    .eq("aktif", true);
  const magazaIdleri = (magazalarHam ?? []).map((m: any) => m.id);

  const [normRes, personelRes, talepRes, performansMagazaRes] = await Promise.all([
    magazaIdleri.length > 0
      ? supabase.from("norm").select("magaza_id, ana_kadro_norm, donemsel_norm, part_time_norm").in("magaza_id", magazaIdleri)
      : Promise.resolve({ data: [] as any[] }),
    magazaIdleri.length > 0
      ? supabase.from("personel").select("guncel_magaza_id, kadro_kategorisi, durum, performans_ortalama_hgo, performans_80_alti_sayisi, performans_80_100_arasi_sayisi, performans_100_ustu_sayisi").in("guncel_magaza_id", magazaIdleri)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("talepler").select("talep_turu, durum"),
    magazaIdleri.length > 0
      ? supabase.from("performans_magaza_aylik").select("magaza_id, yil, ay, hgo").in("magaza_id", magazaIdleri).order("yil").order("ay")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const normMap: Record<string, { ana: number; don: number; pt: number }> = {};
  (normRes.data ?? []).forEach((n: any) => {
    normMap[n.magaza_id] = { ana: n.ana_kadro_norm ?? 0, don: n.donemsel_norm ?? 0, pt: n.part_time_norm ?? 0 };
  });

  const doluMap: Record<string, number> = {};
  const aktifPersonel = (personelRes.data ?? []).filter((p: any) => p.durum === "aktif");
  aktifPersonel.forEach((p: any) => {
    if (["ANA_KADRO", "DONEMSEL", "PART_TIME"].includes(p.kadro_kategorisi)) {
      doluMap[p.guncel_magaza_id] = (doluMap[p.guncel_magaza_id] ?? 0) + 1;
    }
  });

  const bolgeDoluluk: Record<string, { bolge: string; dolu: number; norm: number }> = {};
  (magazalarHam ?? []).forEach((m: any) => {
    const bolgeAdi = m.bolgeler?.ad ?? "Tanımsız";
    const n = normMap[m.id] ?? { ana: 0, don: 0, pt: 0 };
    const toplamNorm = n.ana + n.don + n.pt;
    const dolu = doluMap[m.id] ?? 0;
    if (!bolgeDoluluk[bolgeAdi]) bolgeDoluluk[bolgeAdi] = { bolge: bolgeAdi, dolu: 0, norm: 0 };
    bolgeDoluluk[bolgeAdi].dolu += dolu;
    bolgeDoluluk[bolgeAdi].norm += toplamNorm;
  });
  const normDolulukVerisi = Object.values(bolgeDoluluk).sort((a, b) => a.bolge.localeCompare(b.bolge, "tr"));

  // 2) Talep durum dağılımı
  const TALEP_DURUM_ETIKET: Record<string, string> = {
    BEKLEMEDE: "Beklemede", KABUL_EDILDI: "Kabul Edildi", DURAKLADI: "Duraklamış",
    KAPANDI_RED: "Kapandı (Red)", ISLEME_DEVAM: "İşlemde",
  };
  const talepDurumSayaci: Record<string, number> = {};
  (talepRes.data ?? []).forEach((t: any) => {
    const etiket = TALEP_DURUM_ETIKET[t.durum] ?? t.durum;
    talepDurumSayaci[etiket] = (talepDurumSayaci[etiket] ?? 0) + 1;
  });
  const talepDurumVerisi = Object.entries(talepDurumSayaci).map(([durum, adet]) => ({ durum, adet }));

  const talepTuruSayaci: Record<string, number> = {};
  (talepRes.data ?? []).forEach((t: any) => {
    const etiket = t.talep_turu === "ISE_ALIM" ? "İşe Alım" : "İşten Çıkarma";
    talepTuruSayaci[etiket] = (talepTuruSayaci[etiket] ?? 0) + 1;
  });
  const talepTuruVerisi = Object.entries(talepTuruSayaci).map(([tur, adet]) => ({ tur, adet }));

  // 3) Kişi bazlı performans dağılımı (HGO kategorileri) - performans verisi olan personel üzerinden
  const performansliPersonel = aktifPersonel.filter((p: any) => p.performans_ortalama_hgo != null);
  const hgoDagilimi = [
    { kategori: "%80 altı", adet: performansliPersonel.filter((p: any) => p.performans_ortalama_hgo < 80).length },
    { kategori: "%80–100", adet: performansliPersonel.filter((p: any) => p.performans_ortalama_hgo >= 80 && p.performans_ortalama_hgo <= 100).length },
    { kategori: "%100 üstü", adet: performansliPersonel.filter((p: any) => p.performans_ortalama_hgo > 100).length },
  ];

  // 4) Kadro kategorisi dağılımı (aktif personel)
  const KATEGORI_LABEL: Record<string, string> = { ANA_KADRO: "Ana Kadro", DONEMSEL: "Dönemsel", PART_TIME: "Part Time" };
  const kategoriSayaci: Record<string, number> = {};
  aktifPersonel.forEach((p: any) => {
    if (["ANA_KADRO", "DONEMSEL", "PART_TIME"].includes(p.kadro_kategorisi)) {
      const etiket = KATEGORI_LABEL[p.kadro_kategorisi];
      kategoriSayaci[etiket] = (kategoriSayaci[etiket] ?? 0) + 1;
    }
  });
  const kadroKategorisiVerisi = Object.entries(kategoriSayaci).map(([kategori, adet]) => ({ kategori, adet }));

  // 5) Mağaza HGO aylık trend (bölge bazlı ortalama, ay bazında)
  const magazaBolgeMap: Record<string, string> = {};
  (magazalarHam ?? []).forEach((m: any) => { magazaBolgeMap[m.id] = m.bolgeler?.ad ?? "Tanımsız"; });

  const aySayac: Record<string, { toplam: number; adet: number }> = {};
  (performansMagazaRes.data ?? []).forEach((p: any) => {
    if (p.hgo == null) return;
    const key = `${p.yil}-${String(p.ay).padStart(2, "0")}`;
    if (!aySayac[key]) aySayac[key] = { toplam: 0, adet: 0 };
    aySayac[key].toplam += p.hgo;
    aySayac[key].adet += 1;
  });
  const hgoTrendVerisi = Object.entries(aySayac)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ay, v]) => ({ ay, ortalamaHgo: Math.round((v.toplam / v.adet) * 10) / 10 }));

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Raporlar</div>
        <div className="text-xs text-gray-400 mt-0.5">Yetkiniz dahilindeki verilere göre özet grafikler</div>
      </div>
      <RaporlarClient
        normDolulukVerisi={normDolulukVerisi}
        talepDurumVerisi={talepDurumVerisi}
        talepTuruVerisi={talepTuruVerisi}
        hgoDagilimi={hgoDagilimi}
        kadroKategorisiVerisi={kadroKategorisiVerisi}
        hgoTrendVerisi={hgoTrendVerisi}
        performansVeriSayisi={performansliPersonel.length}
      />
    </div>
  );
}
