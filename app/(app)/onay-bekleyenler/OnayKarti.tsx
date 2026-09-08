"use client";

import { useState, useTransition } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { kararVer } from "./actions";
import { getMagazaBilgi, type MagazaBilgi } from "../talepler/yeni/actions-magaza-bilgi";
import { getPersonelPerformansGecmisi, getPersonelDetay, type PersonelAylikHgo, type PersonelDetay } from "../talepler/yeni/actions-cikarma";

const AY_KISA = ["", "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const TALEP_TURU_ETIKET: Record<string, string> = {
  ISE_ALIM: "İşe Alım", ISTEN_CIKARMA: "İşten Çıkarma", ROTASYON: "Rotasyon", NORM_DEGISIKLIK: "Norm Değişikliği",
};
const KATEGORI_LABEL: Record<string, string> = { ANA_KADRO: "Ana Kadro", DONEMSEL: "Dönemsel", PART_TIME: "Part-Time" };

function MiniKpi({ label, value, vurgu }: { label: string; value: string; vurgu?: boolean }) {
  return (
    <div className={`rounded-md px-2.5 py-2 ${vurgu ? "bg-danger-bg" : "bg-gray-50"}`}>
      <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-semibold ${vurgu ? "text-danger" : "text-navy-3"}`}>{value}</div>
    </div>
  );
}

export default function OnayKarti({
  onayId, talepNo, talepTuru, magaza, magazaId, pozisyon, kisiSayisi, acanRol, aciklama, normSonuc,
  cikarilacakPersonelId, cikarilacakPersonelAdi, cikarilacakPersonelUnvan, normKategori, normEski, normYeni,
}: {
  onayId: string; talepNo: string; talepTuru: string; magaza?: string; magazaId?: string; pozisyon?: string;
  kisiSayisi?: number; acanRol?: string; aciklama?: string | null; normSonuc?: string | null;
  cikarilacakPersonelId?: string; cikarilacakPersonelAdi?: string; cikarilacakPersonelUnvan?: string;
  normKategori?: string; normEski?: number; normYeni?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [redMod, setRedMod] = useState(false);
  const [redAciklama, setRedAciklama] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [detayAcik, setDetayAcik] = useState(false);
  const [detayYukleniyor, setDetayYukleniyor] = useState(false);
  const [magazaBilgi, setMagazaBilgi] = useState<MagazaBilgi | null>(null);
  const [personelGecmisi, setPersonelGecmisi] = useState<PersonelAylikHgo[]>([]);
  const [personelDetay, setPersonelDetay] = useState<PersonelDetay | null>(null);

  function detaylariGoster() {
    if (detayAcik) { setDetayAcik(false); return; }
    setDetayAcik(true);
    if (magazaBilgi || personelDetay) return; // zaten çekildi
    setDetayYukleniyor(true);
    if (talepTuru === "ISTEN_CIKARMA" && cikarilacakPersonelId) {
      Promise.all([
        getPersonelDetay(cikarilacakPersonelId),
        getPersonelPerformansGecmisi(cikarilacakPersonelId),
      ]).then(([detay, gecmis]) => {
        setPersonelDetay(detay);
        setPersonelGecmisi(gecmis);
        setDetayYukleniyor(false);
      });
    } else if (magazaId) {
      getMagazaBilgi(magazaId).then((veri) => { setMagazaBilgi(veri); setDetayYukleniyor(false); });
    } else {
      setDetayYukleniyor(false);
    }
  }

  const hgoGrafikVerisi = talepTuru === "ISTEN_CIKARMA"
    ? personelGecmisi.filter((h) => h.hgo !== null).map((h) => ({ etiket: `${AY_KISA[h.ay]} ${String(h.yil).slice(2)}`, hgo: h.hgo }))
    : (magazaBilgi?.hgoGecmisi ?? []).filter((h) => h.hgo !== null).map((h) => ({ etiket: `${AY_KISA[h.ay]} ${String(h.yil).slice(2)}`, hgo: h.hgo }));

  function gonder(karar: "ONAY" | "RED") {
    setError(null);
    const fd = new FormData();
    fd.set("onay_id", onayId);
    fd.set("karar", karar);
    fd.set("aciklama", redAciklama);
    startTransition(async () => {
      const res = await kararVer(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-navy-3">{talepNo}</span>
            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{TALEP_TURU_ETIKET[talepTuru] ?? talepTuru}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {talepTuru === "ISE_ALIM" && <>{magaza} — {pozisyon} — {kisiSayisi} kişi</>}
            {talepTuru === "ISTEN_CIKARMA" && <>{magaza} — {cikarilacakPersonelAdi} ({cikarilacakPersonelUnvan})</>}
            {talepTuru === "NORM_DEGISIKLIK" && <>{magaza} — {KATEGORI_LABEL[normKategori ?? ""] ?? normKategori}: {normEski} → {normYeni}</>}
            {" "}— Açan: {acanRol}
          </div>
        </div>
        {normSonuc === "UYGUN_DEGIL_ISRARLI" && (
          <span className="text-[10px] bg-danger-bg text-danger px-2 py-0.5 rounded-full font-medium shrink-0">
            Norm Aşımı — Israrlı
          </span>
        )}
      </div>
      {aciklama && <div className="text-xs text-gray-600 mb-3">"{aciklama}"</div>}

      <button onClick={detaylariGoster} className="text-[11px] text-info hover:underline mb-3">
        {detayAcik ? "Detayları Gizle ▲" : "Mağaza / Performans Detaylarını Göster ▾"}
      </button>

      {detayAcik && (
        <div className="bg-gray-50 border border-gray-100 rounded-md p-3 mb-3 space-y-3">
          {detayYukleniyor ? (
            <div className="text-xs text-gray-400 py-4 text-center flex items-center justify-center gap-2">
              <span className="yukleniyor-donen" /> Yükleniyor...
            </div>
          ) : talepTuru === "ISTEN_CIKARMA" ? (
            !personelDetay ? (
              <div className="text-xs text-gray-400 py-4 text-center">Personel bilgisi bulunamadı.</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <MiniKpi label="Ort. HGO" value={personelGecmisi.length > 0 ? `%${(personelGecmisi.reduce((s, g) => s + (g.hgo ?? 0), 0) / personelGecmisi.filter((g) => g.hgo != null).length || 0).toFixed(1)}` : "—"} />
                  <MiniKpi label="Kıdem" value={personelDetay.kidem_ay != null ? `${Math.floor(personelDetay.kidem_ay / 12)}y ${personelDetay.kidem_ay % 12}a` : "—"} />
                  <MiniKpi label="Görev Yeri" value={personelDetay.il_adi ?? "—"} />
                </div>
                {hgoGrafikVerisi.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold text-navy-3 mb-1">HGO (Ciro) — Aylık</div>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={hgoGrafikVerisi} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="etiket" tick={{ fontSize: 8 }} />
                        <YAxis tick={{ fontSize: 8 }} />
                        <Tooltip formatter={(v: number) => `%${v.toFixed(1)}`} labelStyle={{ fontSize: 10 }} />
                        <Line type="monotone" dataKey="hgo" stroke="#0F1B4D" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {(personelDetay.ihtarname || personelDetay.uyari_yazisi || personelDetay.tutanak || personelDetay.savunma) && (
                  <div className="grid grid-cols-4 gap-2">
                    <MiniKpi label="İhtarname" value={String(Number(personelDetay.ihtarname) || 0)} vurgu={(Number(personelDetay.ihtarname) || 0) > 0} />
                    <MiniKpi label="Uyarı" value={String(Number(personelDetay.uyari_yazisi) || 0)} vurgu={(Number(personelDetay.uyari_yazisi) || 0) > 0} />
                    <MiniKpi label="Tutanak" value={String(Number(personelDetay.tutanak) || 0)} />
                    <MiniKpi label="Savunma" value={String(Number(personelDetay.savunma) || 0)} />
                  </div>
                )}
              </>
            )
          ) : !magazaBilgi ? (
            <div className="text-xs text-gray-400 py-4 text-center">Bilgi bulunamadı.</div>
          ) : (
            <>
              <div className="text-[11px] text-gray-500">
                {magazaBilgi.bolge_adi}{magazaBilgi.magaza_muduru && ` — Müdür: ${magazaBilgi.magaza_muduru}`}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MiniKpi label="Ana Kadro" value={`${magazaBilgi.ana_dolu} / ${magazaBilgi.ana_norm}`} vurgu={magazaBilgi.ana_dolu < magazaBilgi.ana_norm} />
                <MiniKpi label="Dönemsel" value={`${magazaBilgi.donemsel_dolu} / ${magazaBilgi.donemsel_norm}`} vurgu={magazaBilgi.donemsel_dolu < magazaBilgi.donemsel_norm} />
                <MiniKpi label="Part-Time" value={`${magazaBilgi.part_dolu} / ${magazaBilgi.part_norm}`} vurgu={magazaBilgi.part_dolu < magazaBilgi.part_norm} />
              </div>
              {hgoGrafikVerisi.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-navy-3 mb-1">HGO (Ciro) — Aylık</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={hgoGrafikVerisi} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="etiket" tick={{ fontSize: 8 }} />
                      <YAxis tick={{ fontSize: 8 }} />
                      <Tooltip formatter={(v: number) => `%${v.toFixed(1)}`} labelStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="hgo" stroke="#0F1B4D" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {magazaBilgi.calisanlar.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-navy-3 mb-1">Mevcut Çalışanlar</div>
                  <div className="max-h-32 overflow-y-auto border border-gray-100 rounded bg-white">
                    <table className="w-full text-[10px]">
                      <tbody>
                        {magazaBilgi.calisanlar.map((c, i) => (
                          <tr key={i} className="border-t border-gray-50 first:border-t-0">
                            <td className="px-2 py-1 text-navy-3 font-medium">{c.ad_soyad}</td>
                            <td className="px-2 py-1 text-gray-500">{c.unvan ?? "—"}</td>
                            <td className={`px-2 py-1 text-right font-mono ${c.hgo == null ? "text-gray-400" : c.hgo < 80 ? "text-danger" : "text-success"}`}>
                              {c.hgo != null ? `%${c.hgo.toFixed(1)}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!redMod ? (
        <div className="flex gap-2">
          <button onClick={() => gonder("ONAY")} disabled={pending}
            className="bg-success text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
            Onayla
          </button>
          <button onClick={() => setRedMod(true)} disabled={pending}
            className="bg-danger-bg text-danger border border-danger/30 rounded-md px-3 py-1.5 text-xs font-medium">
            Reddet
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={redAciklama}
            onChange={(e) => setRedAciklama(e.target.value)}
            placeholder="Red gerekçesi (en az 100 karakter, zorunlu)"
            rows={3}
            minLength={100}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
          />
          <div className={`text-[10px] ${redAciklama.trim().length >= 100 ? "text-success" : "text-gray-400"}`}>
            {redAciklama.trim().length} / 100 karakter
          </div>
          <div className="flex gap-2">
            <button onClick={() => gonder("RED")} disabled={pending || redAciklama.trim().length < 100}
              className="bg-danger text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
              Reddi Onayla
            </button>
            <button onClick={() => setRedMod(false)} className="text-xs text-gray-400">Vazgeç</button>
          </div>
        </div>
      )}
      {error && <div className="text-xs text-danger mt-2">{error}</div>}
    </div>
  );
}
