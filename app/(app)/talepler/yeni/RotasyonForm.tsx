"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { createRotasyonTalebi } from "./actions-rotasyon";
import { getMagazaBilgi, type MagazaBilgi } from "./actions-magaza-bilgi";
import { getPersonelPerformansGecmisi, getPersonelDetay, type PersonelAylikHgo, type PersonelDetay } from "./actions-cikarma";
import MagazaGrafikPaneli from "./MagazaGrafikPaneli";

const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

type Personel = {
  id: string; ad_soyad: string; guncel_unvan: string | null; guncel_magaza_id: string;
  magaza_adi: string; bolge_adi: string; kadro_kategorisi: string | null;
};
type Magaza = {
  id: string; magaza_adi: string; magaza_kodu: string; bolge_id: string; bolge_adi: string;
  ana_kadro_norm: number; donemsel_norm: number; part_time_norm: number;
};

function MiniKpi({ label, value, vurgu }: { label: string; value: string; vurgu?: boolean }) {
  return (
    <div className={`rounded-md px-2.5 py-2 ${vurgu ? "bg-danger-bg" : "bg-gray-50"}`}>
      <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-semibold ${vurgu ? "text-danger" : "text-navy-3"}`}>{value}</div>
    </div>
  );
}

function MagazaOzetPaneli({ baslik, bilgi, yukleniyor }: { baslik: string; bilgi: MagazaBilgi | null; yukleniyor: boolean }) {
  if (yukleniyor) {
    return <div className="text-xs text-gray-400 py-8 text-center flex items-center justify-center gap-2"><span className="yukleniyor-donen" /> Yükleniyor...</div>;
  }
  if (!bilgi) {
    return <div className="text-xs text-gray-400 py-8 text-center">Mağaza bilgisi bulunamadı.</div>;
  }
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-navy-3">{baslik}: {bilgi.magaza_adi}</div>
        <div className="text-[11px] text-gray-400">
          {bilgi.bolge_adi}{bilgi.magaza_muduru && ` — Müdür: ${bilgi.magaza_muduru}`}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="Ana Kadro" value={`${bilgi.ana_dolu} / ${bilgi.ana_norm}`} vurgu={bilgi.ana_dolu >= bilgi.ana_norm} />
        <MiniKpi label="Dönemsel" value={`${bilgi.donemsel_dolu} / ${bilgi.donemsel_norm}`} vurgu={bilgi.donemsel_dolu >= bilgi.donemsel_norm} />
        <MiniKpi label="Part-Time" value={`${bilgi.part_dolu} / ${bilgi.part_norm}`} vurgu={bilgi.part_dolu >= bilgi.part_norm} />
      </div>

      <MagazaGrafikPaneli aylikVeri={bilgi.aylikVeri} varsayilanDegisken="hgo" />

      {bilgi.calisanlar.length > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <div className="text-[11px] font-semibold text-navy-3 mb-2">Mevcut Çalışanlar</div>
          <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-md">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 text-[9px] text-gray-400 uppercase sticky top-0">
                  <th className="text-left px-2 py-1.5">Ad Soyad</th>
                  <th className="text-left px-2 py-1.5">Ünvan</th>
                  <th className="text-right px-2 py-1.5">Ort. HGO</th>
                </tr>
              </thead>
              <tbody>
                {bilgi.calisanlar.map((c, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-2 py-1.5 text-navy-3 font-medium">{c.ad_soyad}</td>
                    <td className="px-2 py-1.5 text-gray-500">{c.unvan ?? "—"}</td>
                    <td className={`px-2 py-1.5 text-right font-mono font-semibold ${
                      c.hgo == null ? "text-gray-400" : c.hgo < 80 ? "text-danger" : "text-success"
                    }`}>
                      {c.hgo != null ? `%${c.hgo.toFixed(1)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonelOzetPaneli({ ad, gecmis, detay, yukleniyor }: {
  ad: string; gecmis: PersonelAylikHgo[]; detay: PersonelDetay | null; yukleniyor: boolean;
}) {
  if (yukleniyor) {
    return <div className="text-xs text-gray-400 py-8 text-center flex items-center justify-center gap-2"><span className="yukleniyor-donen" /> Yükleniyor...</div>;
  }
  const ortalamaHgo = gecmis.filter((g) => g.hgo != null).length > 0
    ? gecmis.reduce((s, g) => s + (g.hgo ?? 0), 0) / gecmis.filter((g) => g.hgo != null).length
    : null;
  const grafikVerisi = gecmis.filter((g) => g.hgo !== null).map((g) => ({ etiket: `${AY_KISA[g.ay]} ${String(g.yil).slice(2)}`, hgo: g.hgo }));

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-navy-3">{ad}</div>

      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="Ort. HGO" value={ortalamaHgo != null ? `%${ortalamaHgo.toFixed(1)}` : "—"} vurgu={ortalamaHgo != null && ortalamaHgo < 80} />
        <MiniKpi label="Kıdem" value={detay?.kidem_ay != null ? `${Math.floor(detay.kidem_ay / 12)}y ${detay.kidem_ay % 12}a` : "—"} />
        <MiniKpi label="Görev Yeri" value={detay?.il_adi ?? "—"} />
      </div>

      <div>
        <div className="text-[11px] font-semibold text-navy-3 mb-1">HGO (Ciro) — Aylık</div>
        {grafikVerisi.length === 0 ? (
          <div className="text-xs text-gray-400 py-6 text-center">Bu personel için performans verisi yok.</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={grafikVerisi} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="etiket" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v: number) => `%${v.toFixed(1)}`} labelStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="hgo" stroke="#0F1B4D" strokeWidth={2} dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {detay && (detay.ihtarname || detay.uyari_yazisi || detay.tutanak || detay.savunma) && (
        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-100">
          <MiniKpi label="İhtarname" value={String(Number(detay.ihtarname) || 0)} vurgu={(Number(detay.ihtarname) || 0) > 0} />
          <MiniKpi label="Uyarı" value={String(Number(detay.uyari_yazisi) || 0)} vurgu={(Number(detay.uyari_yazisi) || 0) > 0} />
          <MiniKpi label="Tutanak" value={String(Number(detay.tutanak) || 0)} />
          <MiniKpi label="Savunma" value={String(Number(detay.savunma) || 0)} />
        </div>
      )}
    </div>
  );
}

export default function RotasyonForm({ personelListesi, magazalar }: { personelListesi: Personel[]; magazalar: Magaza[] }) {
  const [pending, startTransition] = useTransition();
  const [normUyari, setNormUyari] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [israrli, setIsrarli] = useState(false);

  const bolgeler = useMemo(() => Array.from(new Set(personelListesi.map((p) => p.bolge_adi))).sort(), [personelListesi]);
  const [personelBolgeFiltre, setPersonelBolgeFiltre] = useState("");
  const [personelArama, setPersonelArama] = useState("");
  const [secilenPersonelId, setSecilenPersonelId] = useState("");

  const [hedefBolgeFiltre, setHedefBolgeFiltre] = useState("");
  const [hedefMagazaId, setHedefMagazaId] = useState("");

  const [aktifPanel, setAktifPanel] = useState<"hedef" | "kaynak" | "personel">("hedef");

  const filtrelenmisPersonel = useMemo(() => {
    return personelListesi.filter((p) => {
      if (personelBolgeFiltre && p.bolge_adi !== personelBolgeFiltre) return false;
      if (personelArama) {
        const q = personelArama.toLocaleLowerCase("tr-TR");
        if (!p.ad_soyad.toLocaleLowerCase("tr-TR").includes(q) && !(p.guncel_unvan ?? "").toLocaleLowerCase("tr-TR").includes(q)) return false;
      }
      return true;
    });
  }, [personelListesi, personelBolgeFiltre, personelArama]);

  const secilenPersonel = personelListesi.find((p) => p.id === secilenPersonelId);

  const hedefMagazalar = useMemo(() => {
    return magazalar.filter((m) => {
      if (secilenPersonel && m.id === secilenPersonel.guncel_magaza_id) return false; // kendi mağazası hariç
      if (hedefBolgeFiltre && m.bolge_adi !== hedefBolgeFiltre) return false;
      return true;
    });
  }, [magazalar, secilenPersonel, hedefBolgeFiltre]);

  // Hedef mağaza bilgisi
  const [hedefBilgi, setHedefBilgi] = useState<MagazaBilgi | null>(null);
  const [hedefYukleniyor, setHedefYukleniyor] = useState(false);
  useEffect(() => {
    if (!hedefMagazaId) { setHedefBilgi(null); return; }
    setHedefYukleniyor(true);
    getMagazaBilgi(hedefMagazaId).then((veri) => { setHedefBilgi(veri); setHedefYukleniyor(false); });
  }, [hedefMagazaId]);

  // Kaynak (mevcut) mağaza bilgisi — personel seçilir seçilmez, hedef beklemeden çekilir.
  const [kaynakBilgi, setKaynakBilgi] = useState<MagazaBilgi | null>(null);
  const [kaynakYukleniyor, setKaynakYukleniyor] = useState(false);
  useEffect(() => {
    if (!secilenPersonel?.guncel_magaza_id) { setKaynakBilgi(null); return; }
    setKaynakYukleniyor(true);
    getMagazaBilgi(secilenPersonel.guncel_magaza_id).then((veri) => { setKaynakBilgi(veri); setKaynakYukleniyor(false); });
  }, [secilenPersonel?.guncel_magaza_id]);

  // Seçilen personelin kendi performans geçmişi.
  const [personelGecmis, setPersonelGecmis] = useState<PersonelAylikHgo[]>([]);
  const [personelDetay, setPersonelDetay] = useState<PersonelDetay | null>(null);
  const [personelYukleniyor, setPersonelYukleniyor] = useState(false);
  useEffect(() => {
    if (!secilenPersonelId) { setPersonelGecmis([]); setPersonelDetay(null); return; }
    setPersonelYukleniyor(true);
    Promise.all([getPersonelPerformansGecmisi(secilenPersonelId), getPersonelDetay(secilenPersonelId)]).then(([gecmis, detay]) => {
      setPersonelGecmis(gecmis);
      setPersonelDetay(detay);
      setPersonelYukleniyor(false);
    });
  }, [secilenPersonelId]);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("israrli", String(israrli));
    formData.set("personel_id", secilenPersonelId);
    startTransition(async () => {
      const sonuc = await createRotasyonTalebi(formData);
      if (sonuc?.norm_uyari) setNormUyari(sonuc.norm_uyari);
      else if (sonuc?.error) setError(sonuc.error);
    });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
    <form action={handleSubmit} className="bg-white border border-gray-200 rounded-card p-4 max-w-xl w-full space-y-4 shrink-0">
      <div>
        <div className="text-[10px] font-semibold text-navy-3 uppercase mb-1">Personel Filtrele</div>
        <div className="flex gap-2 mb-2">
          <select value={personelBolgeFiltre} onChange={(e) => setPersonelBolgeFiltre(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1">
            <option value="">Tüm Bölgeler</option>
            {bolgeler.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <input value={personelArama} onChange={(e) => setPersonelArama(e.target.value)}
            placeholder="İsim ara..." className="border border-gray-300 rounded-md px-2 py-1.5 text-xs flex-1" />
        </div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
          Rotasyon Yapılacak Personel * <span className="text-gray-400 normal-case font-normal">({filtrelenmisPersonel.length} kişi)</span>
        </label>
        <select value={secilenPersonelId} onChange={(e) => { setSecilenPersonelId(e.target.value); setHedefMagazaId(""); setAktifPanel("kaynak"); }} required
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {filtrelenmisPersonel.map((p) => (
            <option key={p.id} value={p.id}>{p.ad_soyad}</option>
          ))}
        </select>
        {secilenPersonel && (
          <div className="text-[11px] text-gray-500 mt-1.5">
            {secilenPersonel.guncel_unvan} — {secilenPersonel.magaza_adi} ({secilenPersonel.bolge_adi})
          </div>
        )}
      </div>

      <div>
        <div className="text-[10px] font-semibold text-navy-3 uppercase mb-1">Hedef Mağaza Filtrele</div>
        <select value={hedefBolgeFiltre} onChange={(e) => setHedefBolgeFiltre(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-full mb-2">
          <option value="">Tüm Bölgeler</option>
          {Array.from(new Set(magazalar.map((m) => m.bolge_adi))).sort().map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Hedef Mağaza *</label>
        <select name="hedef_magaza_id" value={hedefMagazaId} onChange={(e) => { setHedefMagazaId(e.target.value); setAktifPanel("hedef"); }} required disabled={!secilenPersonelId}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400">
          <option value="">{secilenPersonelId ? "Seçin" : "Önce personel seçin"}</option>
          {hedefMagazalar.map((m) => (
            <option key={m.id} value={m.id}>{m.magaza_adi} ({m.magaza_kodu}) — {m.bolge_adi}</option>
          ))}
        </select>
      </div>

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
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Açıklama {israrli && "*"}</label>
        <textarea name="aciklama" rows={3} required={israrli} minLength={israrli ? 100 : undefined}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>

      {error && <div className="text-xs text-danger">{error}</div>}

      <button type="submit" disabled={pending || !secilenPersonelId || !hedefMagazaId}
        className="bg-navy hover:bg-navy-2 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
        {pending ? (<span className="flex items-center justify-center gap-2"><span className="yukleniyor-donen" /> Gönderiliyor</span>) : "Talebi Gönder"}
      </button>
    </form>

    {secilenPersonelId && (
      <div className="bg-white border border-gray-200 rounded-card p-4 w-full space-y-4">
        <div className="flex rounded-md border border-gray-200 overflow-hidden w-fit">
          <button onClick={() => setAktifPanel("hedef")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${aktifPanel === "hedef" ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            Hedef Mağaza
          </button>
          <button onClick={() => setAktifPanel("kaynak")}
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 transition-colors ${aktifPanel === "kaynak" ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            Mevcut Mağaza
          </button>
          <button onClick={() => setAktifPanel("personel")}
            className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 transition-colors ${aktifPanel === "personel" ? "bg-navy text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            Personel
          </button>
        </div>

        {aktifPanel === "hedef" && (
          hedefMagazaId
            ? <MagazaOzetPaneli baslik="Hedef" bilgi={hedefBilgi} yukleniyor={hedefYukleniyor} />
            : <div className="text-xs text-gray-400 py-8 text-center">Henüz hedef mağaza seçilmedi.</div>
        )}
        {aktifPanel === "kaynak" && (
          <MagazaOzetPaneli baslik="Mevcut" bilgi={kaynakBilgi} yukleniyor={kaynakYukleniyor} />
        )}
        {aktifPanel === "personel" && (
          <PersonelOzetPaneli ad={secilenPersonel?.ad_soyad ?? ""} gecmis={personelGecmis} detay={personelDetay} yukleniyor={personelYukleniyor} />
        )}
      </div>
    )}
    </div>
  );
}
