import { createClient } from "@/lib/supabase/server";
import DashboardPaneller from "./DashboardPaneller";

// Supabase/PostgREST tek sorguda varsayılan olarak en fazla 1000 satır döndürür.
// Mağaza sayısı × ay sayısı ya da aktif personel sayısı bunu kolayca aşabildiği
// için, tüm satırları sayfalayarak (1000'erlik parçalar hâlinde) çekiyoruz.
async function tumSatirlariGetir<T>(sorguOlustur: (bas: number, bitis: number) => any): Promise<T[]> {
  const PARCA = 1000;
  let tumSatirlar: T[] = [];
  let sayfa = 0;
  while (true) {
    const bas = sayfa * PARCA;
    const { data, error } = await sorguOlustur(bas, bas + PARCA - 1);
    if (error || !data) break;
    tumSatirlar = tumSatirlar.concat(data as T[]);
    if (data.length < PARCA) break;
    sayfa++;
  }
  return tumSatirlar;
}

export default async function DashboardPage() {
  const supabase = createClient();

  // RLS otomatik olarak kullanıcının rolüne göre satırları daraltıyor —
  // burada ekstra rol filtresi yazmaya gerek yok.
  const [
    { count: toplamTalep },
    { count: bekleyenTalep },
    { count: onaylananTalep },
    { data: magazalarHam },
    { data: bolgeler },
  ] = await Promise.all([
    supabase.from("talepler").select("*", { count: "exact", head: true }),
    supabase.from("talepler").select("*", { count: "exact", head: true }).eq("durum", "BEKLEMEDE"),
    supabase.from("talepler").select("*", { count: "exact", head: true }).eq("durum", "KABUL_EDILDI"),
    supabase
      .from("magazalar")
      .select("id, magaza_kodu, magaza_adi, bolge_id, subetipi, net_m2, aktif, istifa_turnover, fesih_turnover, toplam_turnover, norm(ana_kadro_norm, donemsel_norm, part_time_norm)")
      .eq("aktif", true),
    supabase.from("bolgeler").select("id, ad").order("ad"),
  ]);

  const personelList = await tumSatirlariGetir<any>((bas, bitis) =>
    supabase
      .from("personel")
      .select("id, guncel_magaza_id, kadro_kategorisi, guncel_unvan, ad_soyad, tc_kimlik_no")
      .eq("durum", "aktif")
      .range(bas, bitis)
  );

  const performansHam = await tumSatirlariGetir<any>((bas, bitis) =>
    supabase
      .from("performans_magaza_aylik")
      .select("magaza_id, yil, ay, hgo, sepet_ortalamasi, sepet_derinligi, donusum_orani, giren_musteri_sayisi, adet_hgo, satis_adeti, toplam_ciro_kdv_dahil, omnichannel_ciro, omnichannel_haric_ciro")
      .range(bas, bitis)
  );

  // Kişi bazlı performans — mağaza KPI'larındaki çalışan sayısı/satış yapan oranı
  // ve mağaza seçilince altında görünen "aktif çalışanlar" listesi için.
  const performansKisiHam = await tumSatirlariGetir<any>((bas, bitis) =>
    supabase
      .from("performans_kisi_aylik")
      .select("personel_id, yil, ay, hgo, adet_hgo, gerceklesen_ciro_kdv_dahil, personel(ad_soyad, guncel_unvan, guncel_magaza_id, durum)")
      .range(bas, bitis)
  );

  // Personel Kodu / Sicil, Personel dosyası ile Çalışan Performans dosyası arasında
  // farklı numaralandırılabiliyor (aynı kişi için iki farklı kod) — bu da aynı kişinin
  // birden fazla kayıtla (bazen "PLASIYER-" yer tutucu, bazen gerçek TC'li) görünmesine
  // yol açıyor. Doluluk sayımında aynı isim + aynı mağaza + aynı kategori kombinasyonu
  // TEK kişi sayılır; gerçek TC'li kayıt varsa o tercih edilir.
  const personelTekil = new Map<string, any>();
  (personelList ?? []).forEach((p: any) => {
    if (!p.guncel_magaza_id) return;
    const anahtar = `${p.guncel_magaza_id}|${String(p.ad_soyad ?? "").trim().toLocaleUpperCase("tr-TR")}|${p.kadro_kategorisi ?? ""}`;
    const mevcut = personelTekil.get(anahtar);
    const buGercekMi = !String(p.tc_kimlik_no ?? "").startsWith("PLASIYER-");
    if (!mevcut || (buGercekMi && String(mevcut.tc_kimlik_no ?? "").startsWith("PLASIYER-"))) {
      personelTekil.set(anahtar, p);
    }
  });
  const personelListTekil = Array.from(personelTekil.values());

  // Mağaza başına, kadro kategorisine göre ayrı ayrı aktif personel sayısı
  const doluMap: Record<string, { ANA_KADRO: number; DONEMSEL: number; PART_TIME: number }> = {};
  personelListTekil.forEach((p: any) => {
    if (!p.guncel_magaza_id) return;
    if (!doluMap[p.guncel_magaza_id]) doluMap[p.guncel_magaza_id] = { ANA_KADRO: 0, DONEMSEL: 0, PART_TIME: 0 };
    if (p.kadro_kategorisi === "ANA_KADRO" || p.kadro_kategorisi === "DONEMSEL" || p.kadro_kategorisi === "PART_TIME") {
      doluMap[p.guncel_magaza_id][p.kadro_kategorisi as "ANA_KADRO" | "DONEMSEL" | "PART_TIME"]++;
    }
  });

  const bolgeMap: Record<string, string> = {};
  (bolgeler ?? []).forEach((b: any) => { bolgeMap[b.id] = b.ad; });

  // Mağaza başına Mağaza Müdürü — "Müdür Yardımcısı" ile karışmasın diye tam ünvan eşleşmesi kullanılıyor.
  const MUDUR_UNVANLARI = ["mağaza müdürü", "havalimanı mağaza müdürü"];
  const magazaMuduruMap: Record<string, string> = {};
  (personelList ?? []).forEach((p: any) => {
    if (!p.guncel_magaza_id || !p.guncel_unvan) return;
    if (MUDUR_UNVANLARI.includes(String(p.guncel_unvan).trim().toLocaleLowerCase("tr-TR"))) {
      magazaMuduruMap[p.guncel_magaza_id] = p.ad_soyad;
    }
  });

  const magazaDetay = (magazalarHam ?? []).map((m: any) => {
    const normRow = Array.isArray(m.norm) ? m.norm[0] : m.norm;
    const anaNorm = normRow?.ana_kadro_norm ?? 0;
    const donemselNorm = normRow?.donemsel_norm ?? 0;
    const partNorm = normRow?.part_time_norm ?? 0;
    const dolu = doluMap[m.id] ?? { ANA_KADRO: 0, DONEMSEL: 0, PART_TIME: 0 };
    const toplamNorm = anaNorm + donemselNorm + partNorm;
    const toplamDolu = dolu.ANA_KADRO + dolu.DONEMSEL + dolu.PART_TIME;
    return {
      id: m.id,
      magaza_kodu: m.magaza_kodu,
      magaza_adi: m.magaza_adi,
      bolge_id: m.bolge_id,
      bolge_adi: m.bolge_id ? bolgeMap[m.bolge_id] ?? "" : "",
      subetipi: m.subetipi,
      net_m2: m.net_m2,
      istifa_turnover: m.istifa_turnover,
      fesih_turnover: m.fesih_turnover,
      toplam_turnover: m.toplam_turnover,
      magaza_muduru: magazaMuduruMap[m.id] ?? null,
      ana_norm: anaNorm, ana_dolu: dolu.ANA_KADRO,
      donemsel_norm: donemselNorm, donemsel_dolu: dolu.DONEMSEL,
      part_norm: partNorm, part_dolu: dolu.PART_TIME,
      toplamNorm, toplamDolu,
      oran: toplamNorm > 0 ? Math.round((toplamDolu / toplamNorm) * 100) : 0,
    };
  });

  const toplamNormGenel = magazaDetay.reduce((s, m) => s + m.toplamNorm, 0);
  const toplamDoluGenel = magazaDetay.reduce((s, m) => s + m.toplamDolu, 0);
  const normDolulukOraniGenel = toplamNormGenel > 0 ? Math.round((toplamDoluGenel / toplamNormGenel) * 100) : 0;

  const anaNormToplam = magazaDetay.reduce((s, m) => s + m.ana_norm, 0);
  const anaDoluToplam = magazaDetay.reduce((s, m) => s + m.ana_dolu, 0);
  const anaOran = anaNormToplam > 0 ? Math.round((anaDoluToplam / anaNormToplam) * 100) : 0;

  const donemselNormToplam = magazaDetay.reduce((s, m) => s + m.donemsel_norm, 0);
  const donemselDoluToplam = magazaDetay.reduce((s, m) => s + m.donemsel_dolu, 0);
  const donemselOran = donemselNormToplam > 0 ? Math.round((donemselDoluToplam / donemselNormToplam) * 100) : 0;

  const partNormToplam = magazaDetay.reduce((s, m) => s + m.part_norm, 0);
  const partDoluToplam = magazaDetay.reduce((s, m) => s + m.part_dolu, 0);
  const partOran = partNormToplam > 0 ? Math.round((partDoluToplam / partNormToplam) * 100) : 0;

  const kpis = [
    { label: "Toplam Talep", value: String(toplamTalep ?? 0) },
    { label: "Bekleyen Talep", value: String(bekleyenTalep ?? 0) },
    { label: "Onaylanan Talep", value: String(onaylananTalep ?? 0) },
    { label: "Ana Kadro Doluluk", value: `%${anaOran} (${anaDoluToplam}/${anaNormToplam})` },
    { label: "Dönemsel Doluluk", value: `%${donemselOran} (${donemselDoluToplam}/${donemselNormToplam})` },
    { label: "Part-Time Doluluk", value: `%${partOran} (${partDoluToplam}/${partNormToplam})` },
  ];

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Norm Kadro Dashboard</div>
        <div className="text-xs text-gray-400 mt-0.5">
          Rol bazlı özet — RLS ile otomatik daraltılmış veri
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-card p-4">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">
              {k.label}
            </div>
            <div className={`font-mono font-semibold text-navy whitespace-nowrap ${k.value.length > 10 ? "text-base" : k.value.length > 6 ? "text-lg" : "text-xl"}`}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <DashboardPaneller
        magazalar={magazaDetay}
        bolgeler={bolgeler ?? []}
        performansHam={performansHam ?? []}
        performansKisiHam={performansKisiHam ?? []}
      />
    </div>
  );
}
