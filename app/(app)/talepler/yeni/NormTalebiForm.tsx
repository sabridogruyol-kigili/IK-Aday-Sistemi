"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createNormDegisiklikTalebi } from "./actions-norm-talebi";
import { getMagazaBilgi, type MagazaBilgi } from "./actions-magaza-bilgi";
import MagazaGrafikPaneli from "./MagazaGrafikPaneli";

type Magaza = {
  id: string;
  magaza_adi: string;
  magaza_kodu: string;
  bolge_adi: string;
  ana_kadro_norm: number;
  donemsel_norm: number;
  part_time_norm: number;
};

const KATEGORI_LABEL: Record<string, string> = {
  ANA_KADRO: "Ana Kadro Norm",
  DONEMSEL: "Dönemsel Norm",
  PART_TIME: "Part-Time Norm",
};

function MiniKpi({ label, value, vurgu }: { label: string; value: string; vurgu?: boolean }) {
  return (
    <div className={`rounded-md px-2.5 py-2 ${vurgu ? "bg-danger-bg" : "bg-gray-50"}`}>
      <div className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-semibold ${vurgu ? "text-danger" : "text-navy-3"}`}>{value}</div>
    </div>
  );
}

export default function NormTalebiForm({
  magazalar, initialMagazaId, initialKategori,
}: {
  magazalar: Magaza[]; initialMagazaId?: string; initialKategori?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bolgeFiltre, setBolgeFiltre] = useState("");
  const [magazaId, setMagazaId] = useState(initialMagazaId ?? "");
  const [kategori, setKategori] = useState(initialKategori ?? "");
  const [yeniDeger, setYeniDeger] = useState("");
  const [aciklama, setAciklama] = useState("");

  const bolgeler = useMemo(() => Array.from(new Set(magazalar.map((m) => m.bolge_adi).filter(Boolean))).sort(), [magazalar]);
  const filtrelenmisMagazalar = useMemo(
    () => (bolgeFiltre ? magazalar.filter((m) => m.bolge_adi === bolgeFiltre) : magazalar),
    [magazalar, bolgeFiltre]
  );
  const seciliMagaza = magazalar.find((m) => m.id === magazaId) ?? null;

  const eskiDeger = seciliMagaza && kategori
    ? kategori === "ANA_KADRO" ? seciliMagaza.ana_kadro_norm
      : kategori === "DONEMSEL" ? seciliMagaza.donemsel_norm
      : seciliMagaza.part_time_norm
    : null;

  const yeniDegerSayi = yeniDeger === "" ? null : parseInt(yeniDeger, 10);
  const fark = eskiDeger != null && yeniDegerSayi != null ? yeniDegerSayi - eskiDeger : null;

  // Seçilen mağazanın norm/doluluk/performans bilgisi — diğer Yeni Talep
  // formlarındaki mantığın aynısı, anlık (on-demand) çekilir.
  const [magazaBilgi, setMagazaBilgi] = useState<MagazaBilgi | null>(null);
  const [magazaBilgiYukleniyor, setMagazaBilgiYukleniyor] = useState(false);
  useEffect(() => {
    if (!magazaId) { setMagazaBilgi(null); return; }
    setMagazaBilgiYukleniyor(true);
    getMagazaBilgi(magazaId).then((veri) => { setMagazaBilgi(veri); setMagazaBilgiYukleniyor(false); });
  }, [magazaId]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const sonuc = await createNormDegisiklikTalebi(formData);
      if (sonuc?.error) setError(sonuc.error);
    });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
    <form action={handleSubmit} className="bg-white border border-gray-200 rounded-card p-4 max-w-xl w-full space-y-4 shrink-0">
      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Bölge (filtre)</label>
        <select value={bolgeFiltre} onChange={(e) => { setBolgeFiltre(e.target.value); setMagazaId(""); }}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Tüm Bölgeler (yetkiniz dahilinde)</option>
          {bolgeler.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Mağaza *</label>
        <select name="magaza_id" required value={magazaId} onChange={(e) => setMagazaId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {filtrelenmisMagazalar.map((m) => (
            <option key={m.id} value={m.id}>{m.magaza_kodu} — {m.magaza_adi}</option>
          ))}
        </select>
      </div>

      {seciliMagaza && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs grid grid-cols-3 gap-2">
          <div><div className="text-[9px] text-gray-400 uppercase">Ana Kadro</div><div className="font-mono font-semibold text-navy-3">{seciliMagaza.ana_kadro_norm}</div></div>
          <div><div className="text-[9px] text-gray-400 uppercase">Dönemsel</div><div className="font-mono font-semibold text-navy-3">{seciliMagaza.donemsel_norm}</div></div>
          <div><div className="text-[9px] text-gray-400 uppercase">Part-Time</div><div className="font-mono font-semibold text-navy-3">{seciliMagaza.part_time_norm}</div></div>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Norm Kategorisi *</label>
        <select name="norm_kategorisi" required value={kategori} onChange={(e) => setKategori(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
          <option value="">Seçin</option>
          {Object.entries(KATEGORI_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {kategori && (
        <div>
          <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
            Yeni {KATEGORI_LABEL[kategori]} Sayısı * <span className="text-gray-400 normal-case font-normal">(mevcut: {eskiDeger})</span>
          </label>
          <input name="norm_yeni_deger" type="number" min={0} required value={yeniDeger}
            onChange={(e) => setYeniDeger(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          {fark !== null && fark !== 0 && (
            <div className={`text-[11px] mt-1 font-medium ${fark > 0 ? "text-accent" : "text-danger"}`}>
              {fark > 0 ? `+${fark} artırılıyor` : `${fark} azaltılıyor`}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Açıklama / Gerekçe *</label>
        <textarea name="aciklama" required rows={3} value={aciklama} onChange={(e) => setAciklama(e.target.value)}
          placeholder="Norm değişikliğinin gerekçesini yazın..."
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
      </div>

      <div className="text-[10px] text-gray-400 bg-gray-50 rounded-md p-2">
        Bu talep, açan hariç BM/İK/Yönetim'in oybirliği ve <strong>Mağazalar Direktörlüğü</strong>'nün onayına gider. Tam onay sonrası norm otomatik güncellenir.
      </div>

      {error && <div className="text-xs text-danger">{error}</div>}

      <button type="submit" disabled={pending || fark === 0}
        className="bg-navy hover:bg-navy-2 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
        {pending ? (<span className="flex items-center justify-center gap-2"><span className="yukleniyor-donen" /> Gönderiliyor</span>) : "Talebi Gönder"}
      </button>
    </form>

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
              <MiniKpi label="Ana Kadro" value={`${magazaBilgi.ana_dolu} / ${magazaBilgi.ana_norm}`} vurgu={magazaBilgi.ana_dolu >= magazaBilgi.ana_norm} />
              <MiniKpi label="Dönemsel" value={`${magazaBilgi.donemsel_dolu} / ${magazaBilgi.donemsel_norm}`} vurgu={magazaBilgi.donemsel_dolu >= magazaBilgi.donemsel_norm} />
              <MiniKpi label="Part-Time" value={`${magazaBilgi.part_dolu} / ${magazaBilgi.part_norm}`} vurgu={magazaBilgi.part_dolu >= magazaBilgi.part_norm} />
            </div>
            {kategori && (
              <div className="text-[10px] text-gray-400 -mt-2">
                Talep edilen kategori: <span className="font-medium text-navy-3">{KATEGORI_LABEL[kategori]}</span> — bu kategorideki doluluk kırmızıysa mevcut kadro zaten dolu/aşkın demektir.
              </div>
            )}

            <MagazaGrafikPaneli aylikVeri={magazaBilgi.aylikVeri} varsayilanDegisken="hgo" />

            {magazaBilgi.calisanlar.length > 0 && (
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
                      {magazaBilgi.calisanlar.map((c, i) => (
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
          </>
        )}
      </div>
    )}
    </div>
  );
}
