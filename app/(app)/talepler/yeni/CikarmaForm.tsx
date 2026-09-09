"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { createIstenCikarmaTalebi, getPersonelPerformansGecmisi, getPersonelDetay, type PersonelAylikHgo, type PersonelDetay } from "./actions-cikarma";
import { kidemYilAyFormat } from "@/lib/kidemFormat";

const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

type Pozisyon = { unvan: string; kategori: string };
type Personel = {
  id: string;
  ad_soyad: string;
  guncel_unvan: string | null;
  magaza_adi: string;
  bolge_adi: string;
  performans_ortalama_hgo: number | null;
  performans_80_alti_sayisi: number | null;
  performans_80_100_arasi_sayisi: number | null;
  performans_100_ustu_sayisi: number | null;
};

const KATEGORI_LABEL: Record<string, string> = {
  ANA_KADRO: "Ana Kadro",
  DONEMSEL: "Dönemsel",
  PART_TIME: "Part Time",
};

// Grafiklerde seçilebilecek kişi bazlı satış değişkenleri.
const KISI_DEGISKENLERI: { key: keyof PersonelAylikHgo; label: string; format: (v: number) => string }[] = [
  { key: "hgo", label: "HGO (Ciro)", format: (v) => `%${v.toFixed(1)}` },
  { key: "adet_hgo", label: "HGO (Adet)", format: (v) => `%${v.toFixed(1)}` },
  { key: "gerceklesen_ciro_kdv_dahil", label: "Gerçekleşen Ciro", format: (v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) },
  { key: "gerceklesen_adet", label: "Gerçekleşen Adet", format: (v) => v.toLocaleString("tr-TR") },
  { key: "brut_kar_marji", label: "Brüt Kâr Marjı", format: (v) => `%${(v * 100).toFixed(1)}` },
  { key: "brut_satis_adeti", label: "Brüt Satış Adedi", format: (v) => v.toLocaleString("tr-TR") },
];

function yasHesapla(dogumTarihi: string | null): number | null {
  if (!dogumTarihi) return null;
  const dogum = new Date(dogumTarihi);
  if (isNaN(dogum.getTime())) return null;
  const simdi = new Date();
  let yas = simdi.getFullYear() - dogum.getFullYear();
  const ayFarki = simdi.getMonth() - dogum.getMonth();
  if (ayFarki < 0 || (ayFarki === 0 && simdi.getDate() < dogum.getDate())) yas--;
  return yas;
}

function MiniKpi({ label, value, vurgu }: { label: string; value: string; vurgu?: boolean }) {
  return (
    <div className={`rounded-md px-2.5 py-2 ${vurgu ? "bg-danger-bg" : "bg-gray-50"}`}>
      <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-semibold ${vurgu ? "text-danger" : "text-navy-3"}`}>{value}</div>
    </div>
  );
}

function OzlukAlani({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase">{label}</div>
      <div className="text-navy-3 font-medium">{value || "—"}</div>
    </div>
  );
}

// Bağımsız bir grafik paneli — kendi değişken seçimini kendi içinde tutar, böylece
// iki grafik aynı anda farklı değişkenler gösterebilir.
function KisiGrafikPaneli({
  gecmis, yukleniyor, varsayilanDegisken, hgoYuksek,
}: {
  gecmis: PersonelAylikHgo[]; yukleniyor: boolean; varsayilanDegisken: keyof PersonelAylikHgo; hgoYuksek: boolean;
}) {
  const [degisken, setDegisken] = useState<keyof PersonelAylikHgo>(varsayilanDegisken);
  const [gorunum, setGorunum] = useState<"grafik" | "liste">("grafik");
  const tanim = KISI_DEGISKENLERI.find((d) => d.key === degisken)!;

  const veri = useMemo(
    () => gecmis
      .filter((g) => g[degisken] !== null && g[degisken] !== undefined)
      .map((g) => ({ etiket: `${AY_KISA[g.ay]} ${String(g.yil).slice(2)}`, deger: g[degisken] as number })),
    [gecmis, degisken]
  );

  const cizgiRengi = degisken === "hgo" && hgoYuksek ? "#B0402E" : degisken === "adet_hgo" ? "#3E7CB1" : "#0F1B4D";

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="text-[11px] font-semibold text-navy-3">{tanim.label} — Aylık</div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            <button onClick={() => setGorunum("grafik")}
              className={`px-1.5 py-0.5 text-[9px] font-medium ${gorunum === "grafik" ? "bg-navy text-white" : "bg-white text-gray-500"}`}>
              Grafik
            </button>
            <button onClick={() => setGorunum("liste")}
              className={`px-1.5 py-0.5 text-[9px] font-medium border-l border-gray-200 ${gorunum === "liste" ? "bg-navy text-white" : "bg-white text-gray-500"}`}>
              Liste
            </button>
          </div>
          <select
            value={degisken}
            onChange={(e) => setDegisken(e.target.value as keyof PersonelAylikHgo)}
            className="border border-gray-300 rounded-md px-1.5 py-1 text-[10px] bg-white"
          >
            {KISI_DEGISKENLERI.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
      </div>
      {yukleniyor ? (
        <div className="text-xs text-gray-400 py-6 text-center">Yükleniyor...</div>
      ) : veri.length === 0 ? (
        <div className="text-xs text-gray-400 py-6 text-center">Veri yok.</div>
      ) : gorunum === "liste" ? (
        <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-md">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase sticky top-0">
                <th className="text-left px-2 py-1.5">Dönem</th>
                <th className="text-right px-2 py-1.5">{tanim.label}</th>
              </tr>
            </thead>
            <tbody>
              {veri.slice().reverse().map((v, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="px-2 py-1.5 text-navy-3 font-medium">{v.etiket}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-gray-700">{tanim.format(v.deger)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={veri} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="etiket" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip formatter={(v: number) => tanim.format(v)} labelStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="deger" stroke={cizgiRengi} strokeWidth={2} dot={{ r: 2.5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function CikarmaForm({
  personelListesi,
  pozisyonlar,
}: {
  personelListesi: Personel[];
  pozisyonlar: Pozisyon[];
}) {
  const [pending, startTransition] = useTransition();
  const [normUyari, setNormUyari] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [israrli, setIsrarli] = useState(false);
  const [yerineAlim, setYerineAlim] = useState(false);
  const [seciliPersonelId, setSeciliPersonelId] = useState("");
  const [aciklama, setAciklama] = useState("");

  const seciliPersonel = personelListesi.find((p) => p.id === seciliPersonelId) ?? null;
  // İyi performans gösteren birinin çıkarılması, düşük performanslı birininkinden
  // daha "anormal" bir durumdur ve ek açıklama gerektirir (kötüye kullanım/keyfi
  // fesih riskine karşı) — bu yüzden eşik HGO %80 ÜSTÜ olarak tanımlanır.
  const hgoYuksek = seciliPersonel != null && seciliPersonel.performans_ortalama_hgo != null && seciliPersonel.performans_ortalama_hgo >= 80;
  const aciklamaZorunlu = israrli || hgoYuksek;

  const [gecmis, setGecmis] = useState<PersonelAylikHgo[]>([]);
  const [gecmisYukleniyor, setGecmisYukleniyor] = useState(false);
  useEffect(() => {
    if (!seciliPersonelId) { setGecmis([]); return; }
    setGecmisYukleniyor(true);
    getPersonelPerformansGecmisi(seciliPersonelId).then((veri) => {
      setGecmis(veri);
      setGecmisYukleniyor(false);
    });
  }, [seciliPersonelId]);

  const [detay, setDetay] = useState<PersonelDetay | null>(null);
  const [detayYukleniyor, setDetayYukleniyor] = useState(false);
  useEffect(() => {
    if (!seciliPersonelId) { setDetay(null); return; }
    setDetayYukleniyor(true);
    getPersonelDetay(seciliPersonelId).then((veri) => {
      setDetay(veri);
      setDetayYukleniyor(false);
    });
  }, [seciliPersonelId]);

  const adetOrtalama = useMemo(() => {
    const degerler = gecmis.map((g) => g.adet_hgo).filter((v): v is number => v !== null);
    return degerler.length > 0 ? degerler.reduce((s, v) => s + v, 0) / degerler.length : null;
  }, [gecmis]);
  const toplamCiro = useMemo(() => gecmis.reduce((s, g) => s + (g.gerceklesen_ciro_kdv_dahil ?? 0), 0), [gecmis]);
  const toplamAdet = useMemo(() => gecmis.reduce((s, g) => s + (g.gerceklesen_adet ?? 0), 0), [gecmis]);

  const yas = detay ? yasHesapla(detay.dogum_tarihi) : null;

  const bolgeler = useMemo(() => Array.from(new Set(personelListesi.map((p) => p.bolge_adi).filter(Boolean))).sort(), [personelListesi]);
  const [bolgeFiltre, setBolgeFiltre] = useState("");
  const [magazaFiltre, setMagazaFiltre] = useState("");
  const [unvanFiltre, setUnvanFiltre] = useState("");
  const [arama, setArama] = useState("");

  const magazalar = useMemo(() => {
    const kaynak = bolgeFiltre ? personelListesi.filter((p) => p.bolge_adi === bolgeFiltre) : personelListesi;
    return Array.from(new Set(kaynak.map((p) => p.magaza_adi).filter(Boolean))).sort();
  }, [personelListesi, bolgeFiltre]);
  const unvanlar = useMemo(() => Array.from(new Set(personelListesi.map((p) => p.guncel_unvan).filter(Boolean))).sort() as string[], [personelListesi]);

  const filtrelenmisPersonel = useMemo(() => {
    return personelListesi.filter((p) => {
      if (bolgeFiltre && p.bolge_adi !== bolgeFiltre) return false;
      if (magazaFiltre && p.magaza_adi !== magazaFiltre) return false;
      if (unvanFiltre && p.guncel_unvan !== unvanFiltre) return false;
      if (arama) {
        const q = arama.toLocaleLowerCase("tr-TR");
        if (!p.ad_soyad.toLocaleLowerCase("tr-TR").includes(q)) return false;
      }
      return true;
    });
  }, [personelListesi, bolgeFiltre, magazaFiltre, unvanFiltre, arama]);

  const gruplar = Array.from(new Set(pozisyonlar.map((p) => p.kategori)));

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("yerine_alim", String(yerineAlim));
    formData.set("israrli", String(israrli));
    startTransition(async () => {
      const sonuc = await createIstenCikarmaTalebi(formData);
      if (sonuc?.norm_uyari) setNormUyari(sonuc.norm_uyari);
      else if (sonuc?.error) setError(sonuc.error);
    });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
    <form action={handleSubmit} className="bg-white border border-gray-200 rounded-card p-4 max-w-xl w-full space-y-4 shrink-0">
      <div>
        <div className="text-[10px] font-semibold text-navy-3 uppercase mb-1">Filtrele</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select value={bolgeFiltre} onChange={(e) => { setBolgeFiltre(e.target.value); setMagazaFiltre(""); }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs">
            <option value="">Tüm Bölgeler (yetkiniz dahilinde)</option>
            {bolgeler.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={magazaFiltre} onChange={(e) => setMagazaFiltre(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs">
            <option value="">Tüm Mağazalar</option>
            {magazalar.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={unvanFiltre} onChange={(e) => setUnvanFiltre(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs">
            <option value="">Tüm Ünvanlar</option>
            {unvanlar.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <input value={arama} onChange={(e) => setArama(e.target.value)}
            placeholder="İsim ara..." className="border border-gray-300 rounded-md px-2 py-1.5 text-xs" />
        </div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
          Çıkarılacak Personel * <span className="text-gray-400 normal-case font-normal">({filtrelenmisPersonel.length} kişi)</span>
        </label>
        <select name="personel_id" required value={seciliPersonelId}
          onChange={(e) => setSeciliPersonelId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {filtrelenmisPersonel.map((p) => (
            <option key={p.id} value={p.id}>{p.ad_soyad}</option>
          ))}
        </select>
        {seciliPersonel && (
          <div className="text-[11px] text-gray-500 mt-1.5">
            {seciliPersonel.guncel_unvan} — {seciliPersonel.magaza_adi} ({seciliPersonel.bolge_adi})
          </div>
        )}
      </div>

      {seciliPersonel && (
        <div className={`rounded-md p-3 text-xs ${hgoYuksek ? "bg-danger-bg border border-danger/30" : "bg-gray-50 border border-gray-200"}`}>
          <div className="font-semibold text-navy-3 mb-1">Performans Özeti — {seciliPersonel.ad_soyad}</div>
          {seciliPersonel.performans_ortalama_hgo == null ? (
            <div className="text-gray-400">Bu personel için henüz performans verisi içe aktarılmamış.</div>
          ) : (
            <div className={hgoYuksek ? "text-danger font-semibold" : "text-gray-700"}>
              Ortalama HGO: %{seciliPersonel.performans_ortalama_hgo.toFixed(1)}
              {hgoYuksek && " — %80 üstü (iyi performans), açıklama zorunlu"}
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={yerineAlim} onChange={(e) => setYerineAlim(e.target.checked)} />
        Yerine alım yapılacak
      </label>

      {yerineAlim && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Yeni Pozisyon Tipi *</label>
            <select name="pozisyon_tipi" required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
              <option value="">Seçin</option>
              {gruplar.map((kategori) => (
                <optgroup key={kategori} label={KATEGORI_LABEL[kategori] ?? kategori}>
                  {pozisyonlar.filter((p) => p.kategori === kategori).map((p) => (
                    <option key={p.unvan} value={p.unvan}>{p.unvan}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Kişi Sayısı *</label>
            <input name="kisi_sayisi" type="number" min={1} required className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          </div>
        </>
      )}

      {normUyari && (
        <div className="bg-danger-bg border border-danger/30 rounded-md p-3 text-xs text-danger space-y-2">
          <div>{normUyari}</div>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={israrli} onChange={(e) => setIsrarli(e.target.checked)} />
            Yine de talep etmek istiyorum (açıklama zorunlu)
          </label>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
          Açıklama {aciklamaZorunlu && "*"}
        </label>
        <textarea name="aciklama" value={aciklama} onChange={(e) => setAciklama(e.target.value)}
          rows={3} required={aciklamaZorunlu} minLength={aciklamaZorunlu ? 100 : undefined}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        {aciklamaZorunlu && (
          <div className={`text-[10px] mt-1 ${aciklama.trim().length >= 100 ? "text-success" : "text-gray-400"}`}>
            {aciklama.trim().length} / 100 karakter
          </div>
        )}
      </div>

      {error && <div className="text-xs text-danger">{error}</div>}

      <button type="submit" disabled={pending || (aciklamaZorunlu && aciklama.trim().length < 100)} className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
        {pending ? (<span className="flex items-center justify-center gap-2"><span className="yukleniyor-donen" /> Gönderiliyor</span>) : "Talebi Gönder"}
      </button>
    </form>

    {seciliPersonel && (
      <div className="bg-white border border-gray-200 rounded-card p-4 w-full space-y-4">
        <div>
          <div className="text-sm font-semibold text-navy-3 mb-2">Performans KPI'ları — {seciliPersonel.ad_soyad}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <MiniKpi label="HGO (Ciro)" value={seciliPersonel.performans_ortalama_hgo != null ? `%${seciliPersonel.performans_ortalama_hgo.toFixed(1)}` : "—"} vurgu={hgoYuksek} />
            <MiniKpi label="HGO (Adet)" value={adetOrtalama != null ? `%${adetOrtalama.toFixed(1)}` : "—"} />
            <MiniKpi label="Toplam Ciro" value={toplamCiro.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} />
            <MiniKpi label="Toplam Adet" value={toplamAdet.toLocaleString("tr-TR")} />
            <MiniKpi label="Toplam Ay" value={String(gecmis.length)} />
            <MiniKpi label="Kıdem (Yıl.Ay)" value={detay ? kidemYilAyFormat(detay.kidem_ay) : "—"} />
            <MiniKpi label="%80 Altı" value={`${seciliPersonel.performans_80_alti_sayisi ?? 0} ay`} />
            <MiniKpi label="%80–100" value={`${seciliPersonel.performans_80_100_arasi_sayisi ?? 0} ay`} />
            <MiniKpi label="%100 Üstü" value={`${seciliPersonel.performans_100_ustu_sayisi ?? 0} ay`} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KisiGrafikPaneli gecmis={gecmis} yukleniyor={gecmisYukleniyor} varsayilanDegisken="hgo" hgoYuksek={hgoYuksek} />
          <KisiGrafikPaneli gecmis={gecmis} yukleniyor={gecmisYukleniyor} varsayilanDegisken="adet_hgo" hgoYuksek={hgoYuksek} />
        </div>

        <div className="pt-3 border-t border-gray-100">
          <div className="text-[11px] font-semibold text-navy-3 mb-2">Özlük Bilgileri</div>
          {detayYukleniyor ? (
            <div className="text-xs text-gray-400">Yükleniyor...</div>
          ) : !detay ? (
            <div className="text-xs text-gray-400">Bilgi bulunamadı.</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <OzlukAlani label="Personel Kodu" value={detay.personel_kodu} />
                <OzlukAlani label="TC Kimlik No" value={detay.tc_kimlik_no} />
                <OzlukAlani label="Telefon" value={detay.ozel_mobil} />
                <OzlukAlani label="Yaş" value={yas != null ? String(yas) : null} />
                <OzlukAlani label="Görev Yeri (İl)" value={detay.il_adi} />
                <OzlukAlani label="Kan Grubu" value={detay.kan_grubu_kodu} />
                <OzlukAlani label="Uyruk" value={detay.uyruk} />
                <OzlukAlani label="Medeni Durum" value={detay.evli === "DOĞRU" || detay.evli === "true" ? "Evli" : detay.evli ? "Bekar" : null} />
                <OzlukAlani label="Önceki İş Yeri" value={detay.onceki_is_yeri} />
              </div>

              <div>
                <div className="text-[9px] text-gray-400 uppercase mb-1.5">Disiplin Kayıtları (Adet)</div>
                <div className="grid grid-cols-4 gap-2">
                  <MiniKpi label="İhtarname" value={String(Number(detay.ihtarname) || 0)} vurgu={(Number(detay.ihtarname) || 0) > 0} />
                  <MiniKpi label="Uyarı Yazısı" value={String(Number(detay.uyari_yazisi) || 0)} vurgu={(Number(detay.uyari_yazisi) || 0) > 0} />
                  <MiniKpi label="Tutanak" value={String(Number(detay.tutanak) || 0)} vurgu={(Number(detay.tutanak) || 0) > 0} />
                  <MiniKpi label="Savunma" value={String(Number(detay.savunma) || 0)} vurgu={(Number(detay.savunma) || 0) > 0} />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <div className="text-[9px] text-gray-400 uppercase mb-1.5">
                  Kıdem Tazminatı Tahmini <span className="normal-case text-gray-400">(prim ve ek ücretler hariç)</span>
                </div>
                {detay.brut_maas == null ? (
                  <div className="text-[11px] text-gray-400 bg-gray-50 rounded-md px-2.5 py-2">
                    Bu personel için maaş bilgisi girilmemiş — Ayarlar &gt; Maaş Bilgileri'nden ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-md px-2.5 py-2">
                    <div className="text-sm font-mono font-semibold text-navy-3">
                      {detay.kidem_tazminati_tahmini != null
                        ? `${detay.kidem_tazminati_tahmini.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
                        : "—"}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Brüt maaş: {detay.brut_maas.toLocaleString("tr-TR")} TL
                      {detay.kidem_tazminati_tavani != null && detay.brut_maas > detay.kidem_tazminati_tavani && (
                        <> — tavan aşıldığı için {detay.kidem_tazminati_tavani.toLocaleString("tr-TR")} TL üzerinden hesaplandı</>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {detay.notlar && (
                <div className="bg-gray-50 rounded-md p-2">
                  <div className="text-[9px] text-gray-500 uppercase font-semibold mb-0.5">Not</div>
                  <div className="text-[10px] text-gray-700 whitespace-pre-line max-h-24 overflow-y-auto">{detay.notlar}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}
    </div>
  );
}
