"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { createIseAlimTalebiToplu } from "./actions-coklu";
import { getMagazaBilgi, type MagazaBilgi } from "./actions-magaza-bilgi";
import YeniMagazaModal from "./YeniMagazaModal";

type Pozisyon = { unvan: string; kategori: string };
type Bolge = { id: string; ad: string };
type PozisyonSatiri = { id: string; pozisyon_tipi: string; kisi_sayisi: number };

const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const KATEGORI_LABEL: Record<string, string> = {
  ANA_KADRO: "Ana Kadro",
  DONEMSEL: "Dönemsel",
  PART_TIME: "Part Time",
};

const KATEGORI_KOD: Record<string, string> = { ANA_KADRO: "ana", DONEMSEL: "donemsel", PART_TIME: "part" };

function MiniKpi({ label, deger, norm }: { label: string; deger: number; norm: number }) {
  const eksik = deger < norm;
  return (
    <div className={`rounded-md px-2.5 py-2 ${eksik ? "bg-danger-bg" : "bg-gray-50"}`}>
      <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-semibold ${eksik ? "text-danger" : "text-navy-3"}`}>{deger} / {norm}</div>
    </div>
  );
}

export default function TalepForm({
  magazalar,
  pozisyonlar,
  bolgeler,
}: {
  magazalar: { id: string; magaza_adi: string; magaza_kodu: string }[];
  pozisyonlar: Pozisyon[];
  bolgeler: Bolge[];
}) {
  const [pending, startTransition] = useTransition();
  const [normUyari, setNormUyari] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [israrli, setIsrarli] = useState(false);
  const [aciklama, setAciklama] = useState("");
  const [magazaId, setMagazaId] = useState("");
  const [yeniMagazaModalAcik, setYeniMagazaModalAcik] = useState(false);
  const [satirlar, setSatirlar] = useState<PozisyonSatiri[]>([
    { id: crypto.randomUUID(), pozisyon_tipi: "", kisi_sayisi: 1 },
  ]);

  const gruplar = Array.from(new Set(pozisyonlar.map((p) => p.kategori)));

  // Seçilen mağazanın norm/doluluk/HGO bilgisi — anlık (on-demand) çekilir.
  const [magazaBilgi, setMagazaBilgi] = useState<MagazaBilgi | null>(null);
  const [magazaBilgiYukleniyor, setMagazaBilgiYukleniyor] = useState(false);

  useEffect(() => {
    if (!magazaId) { setMagazaBilgi(null); return; }
    setMagazaBilgiYukleniyor(true);
    getMagazaBilgi(magazaId).then((veri) => {
      setMagazaBilgi(veri);
      setMagazaBilgiYukleniyor(false);
    });
  }, [magazaId]);

  const hgoGrafikVerisi = useMemo(
    () => (magazaBilgi?.hgoGecmisi ?? [])
      .filter((h) => h.hgo !== null)
      .map((h) => ({ etiket: `${AY_KISA[h.ay]} ${String(h.yil).slice(2)}`, hgo: h.hgo })),
    [magazaBilgi]
  );


  function satirEkle() {
    setSatirlar((s) => [...s, { id: crypto.randomUUID(), pozisyon_tipi: "", kisi_sayisi: 1 }]);
  }
  function satirSil(id: string) {
    setSatirlar((s) => (s.length > 1 ? s.filter((r) => r.id !== id) : s));
  }
  function satirGuncelle(id: string, alan: "pozisyon_tipi" | "kisi_sayisi", deger: string) {
    setSatirlar((s) => s.map((r) => (r.id === id ? { ...r, [alan]: alan === "kisi_sayisi" ? Number(deger) : deger } : r)));
  }

  const gecerliMi = magazaId && satirlar.every((s) => s.pozisyon_tipi && s.kisi_sayisi >= 1);

  function gonder() {
    if (!gecerliMi) return;
    setError(null);
    setNormUyari(null);
    const fd = new FormData();
    fd.set("magaza_id", magazaId);
    fd.set("israrli", String(israrli));
    fd.set("aciklama", aciklama);
    fd.set("pozisyonlar", JSON.stringify(satirlar.map((s) => ({ pozisyon_tipi: s.pozisyon_tipi, kisi_sayisi: s.kisi_sayisi }))));
    startTransition(async () => {
      const res = await createIseAlimTalebiToplu(fd);
      if (res?.norm_uyari) { setNormUyari(res.norm_uyari); return; }
      if (res?.error) { setError(res.error); return; }
      window.location.href = "/talepler";
    });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
    <div className="bg-white border border-gray-200 rounded-card p-4 max-w-xl w-full space-y-4 shrink-0">
      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Mağaza *</label>
        <select value={magazaId} onChange={(e) => setMagazaId(e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {magazalar.map((m) => (
            <option key={m.id} value={m.id}>{m.magaza_adi} ({m.magaza_kodu})</option>
          ))}
        </select>
        <button type="button" onClick={() => setYeniMagazaModalAcik(true)}
          className="mt-2 w-full border border-dashed border-gray-300 rounded-md py-1.5 text-[11px] text-gray-500 hover:border-info hover:text-info hover:bg-info-bg transition-colors">
          + Sistemde Olmayan Yeni Mağaza İçin Talep Aç
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[10px] font-semibold text-navy-3 uppercase">Pozisyonlar *</label>
          <button onClick={satirEkle} type="button" className="text-[11px] text-info underline">+ Pozisyon Ekle</button>
        </div>
        <div className="space-y-2">
          {satirlar.map((satir) => (
            <div key={satir.id} className="flex gap-2 items-center">
              <select value={satir.pozisyon_tipi} onChange={(e) => satirGuncelle(satir.id, "pozisyon_tipi", e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-xs">
                <option value="">Pozisyon seçin</option>
                {gruplar.map((kategori) => (
                  <optgroup key={kategori} label={KATEGORI_LABEL[kategori] ?? kategori}>
                    {pozisyonlar.filter((p) => p.kategori === kategori).map((p) => (
                      <option key={p.unvan} value={p.unvan}>{p.unvan}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input type="number" min={1} value={satir.kisi_sayisi}
                onChange={(e) => satirGuncelle(satir.id, "kisi_sayisi", e.target.value)}
                className="w-16 border border-gray-300 rounded-md px-2 py-1.5 text-xs" />
              <button onClick={() => satirSil(satir.id)} type="button" disabled={satirlar.length <= 1}
                className="text-gray-400 hover:text-danger disabled:opacity-30 text-xs px-1">✕</button>
            </div>
          ))}
        </div>
        {satirlar.length > 1 && (
          <div className="text-[10px] text-gray-400 mt-1">
            Her pozisyon için ayrı bir talep oluşturulur (aynı ana talep numarasının altında), her biri kendi onay sürecinden bağımsız ilerler.
          </div>
        )}
      </div>

      {normUyari && (
        <div className="bg-danger-bg border border-danger/30 rounded-md p-3 text-xs text-danger space-y-2 whitespace-pre-line">
          <div>{normUyari}</div>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={israrli} onChange={(e) => setIsrarli(e.target.checked)} />
            Yine de talep etmek istiyorum (açıklama zorunlu)
          </label>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
          Açıklama {israrli && "*"}
        </label>
        <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)}
          rows={3} minLength={israrli ? 100 : undefined}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        {israrli && (
          <div className={`text-[10px] mt-1 ${aciklama.trim().length >= 100 ? "text-success" : "text-gray-400"}`}>
            {aciklama.trim().length} / 100 karakter
          </div>
        )}
      </div>

      {error && <div className="text-xs text-danger">{error}</div>}

      <button onClick={gonder} disabled={pending || !gecerliMi || (israrli && aciklama.trim().length < 100)}
        className="bg-navy hover:bg-navy-2 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
        {pending ? (<span className="flex items-center justify-center gap-2"><span className="yukleniyor-donen" /> Gönderiliyor</span>) : satirlar.length > 1 ? `${satirlar.length} Talep Gönder` : "Talebi Gönder"}
      </button>
    </div>

    {magazaId && (
      <div className="bg-white border border-gray-200 rounded-card p-4 w-full space-y-4">
        {magazaBilgiYukleniyor ? (
          <div className="text-xs text-gray-400 py-8 text-center flex items-center justify-center gap-2">
            <span className="yukleniyor-donen" /> Mağaza bilgisi yükleniyor...
          </div>
        ) : !magazaBilgi ? (
          <div className="text-xs text-gray-400 py-8 text-center">Mağaza bilgisi bulunamadı.</div>
        ) : (
          <>
            <div>
              <div className="text-sm font-semibold text-navy-3">{magazaBilgi.magaza_adi}</div>
              <div className="text-[11px] text-gray-400">
                {magazaBilgi.bolge_adi}{magazaBilgi.magaza_muduru && ` — Müdür: ${magazaBilgi.magaza_muduru}`}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MiniKpi label="Ana Kadro" deger={magazaBilgi.ana_dolu} norm={magazaBilgi.ana_norm} />
              <MiniKpi label="Dönemsel" deger={magazaBilgi.donemsel_dolu} norm={magazaBilgi.donemsel_norm} />
              <MiniKpi label="Part-Time" deger={magazaBilgi.part_dolu} norm={magazaBilgi.part_norm} />
            </div>

            <div>
              <div className="text-[11px] font-semibold text-navy-3 mb-1">HGO (Ciro) — Aylık</div>
              {hgoGrafikVerisi.length === 0 ? (
                <div className="text-xs text-gray-400 py-6 text-center">Bu mağaza için performans verisi yok.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={hgoGrafikVerisi} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="etiket" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v: number) => `%${v.toFixed(1)}`} labelStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="hgo" stroke="#0F1B4D" strokeWidth={2} dot={{ r: 2.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}
      </div>
    )}

    {yeniMagazaModalAcik && (
      <YeniMagazaModal
        bolgeler={bolgeler}
        pozisyonlar={pozisyonlar}
        onClose={() => setYeniMagazaModalAcik(false)}
        onDone={() => { setYeniMagazaModalAcik(false); window.location.href = "/talepler"; }}
      />
    )}
    </div>
  );
}
