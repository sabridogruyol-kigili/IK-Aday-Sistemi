"use client";

import { useEffect, useState } from "react";
import { getEvrakDetay, belgeKararVer, getBelgeSignedUrl, hatirlatmaGonder, type EvrakDetay } from "./actions";
import { BELGE_LISTESI, belgeGorunurMu, RED_NEDENLERI, type BelgeTipi } from "@/lib/evrakSabitleri";

const DURUM_ROZET: Record<string, string> = {
  BEKLENIYOR: "bg-gray-100 text-gray-500",
  INCELEMEDE: "bg-accent/15 text-accent",
  ONAYLANDI: "bg-success-bg text-success",
  REDDEDILDI: "bg-danger-bg text-danger",
};

function BelgeSatiri({ belgeTipi, tanimAd, kayit, onKarar }: {
  belgeTipi: BelgeTipi; tanimAd: string;
  kayit: EvrakDetay["belgeler"][number] | undefined;
  onKarar: (belgeId: string, karar: "ONAYLANDI" | "REDDEDILDI", redNedeni?: string, redAciklama?: string, ikNotu?: string) => void;
}) {
  const [redModAcik, setRedModAcik] = useState(false);
  const [redNedeni, setRedNedeni] = useState<string>(RED_NEDENLERI[0]);
  const [redAciklama, setRedAciklama] = useState("");
  const [dosyaUrl, setDosyaUrl] = useState<string | null>(null);
  const [dosyaYukleniyor, setDosyaYukleniyor] = useState(false);

  const durum = kayit?.durum ?? "BEKLENIYOR";

  function dosyaGoster(yol: string) {
    setDosyaYukleniyor(true);
    getBelgeSignedUrl(yol).then((res) => {
      setDosyaYukleniyor(false);
      if (res.url) setDosyaUrl(res.url);
    });
  }

  if (!kayit) {
    return (
      <div className="border border-gray-100 rounded-md p-3 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-navy-3">{tanimAd}</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Bekleniyor</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-navy-3">{tanimAd}</div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DURUM_ROZET[durum]}`}>
          {durum === "BEKLENIYOR" ? "Bekleniyor" : durum === "INCELEMEDE" ? "İncelemede" : durum === "ONAYLANDI" ? "Onaylandı" : "Reddedildi"}
        </span>
      </div>

      {durum === "REDDEDILDI" && (
        <div className="bg-danger-bg text-danger text-[11px] rounded-md px-2 py-1.5 mb-2">
          <strong>{kayit.red_nedeni}</strong>{kayit.red_aciklama && <> — {kayit.red_aciklama}</>}
        </div>
      )}
      {kayit.ik_notu && <div className="text-[11px] text-gray-500 bg-gray-50 rounded-md px-2 py-1.5 mb-2">İK Notu: {kayit.ik_notu}</div>}

      {kayit.dosya_yollari.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {kayit.dosya_yollari.map((yol, i) => (
            <button key={i} onClick={() => dosyaGoster(yol)} disabled={dosyaYukleniyor}
              className="text-[11px] text-info hover:underline disabled:opacity-50">
              Dosya {i + 1} Görüntüle
            </button>
          ))}
        </div>
      )}

      {durum === "INCELEMEDE" && !redModAcik && (
        <div className="flex gap-2">
          <button onClick={() => onKarar(kayit.id, "ONAYLANDI")} className="bg-success text-white rounded-md px-3 py-1.5 text-xs font-medium">Onayla</button>
          <button onClick={() => setRedModAcik(true)} className="bg-danger-bg text-danger border border-danger/30 rounded-md px-3 py-1.5 text-xs font-medium">Reddet</button>
        </div>
      )}

      {redModAcik && (
        <div className="space-y-2 mt-1">
          <select value={redNedeni} onChange={(e) => setRedNedeni(e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
            {RED_NEDENLERI.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <textarea value={redAciklama} onChange={(e) => setRedAciklama(e.target.value)}
            placeholder={redNedeni === "Diğer" ? "Açıklama zorunlu..." : "Açıklama (isteğe bağlı, adaya iletilir)"}
            rows={2} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs" />
          <div className="flex gap-2">
            <button onClick={() => onKarar(kayit.id, "REDDEDILDI", redNedeni, redAciklama)}
              className="bg-danger text-white rounded-md px-3 py-1.5 text-xs font-medium">Reddi Onayla</button>
            <button onClick={() => setRedModAcik(false)} className="text-xs text-gray-400">Vazgeç</button>
          </div>
        </div>
      )}

      {dosyaUrl && (
        <div className="fixed inset-0 bg-navy-3/60 z-[60] flex items-center justify-center p-4" onClick={() => setDosyaUrl(null)}>
          <div className="bg-white rounded-card w-full max-w-2xl h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-2 border-b border-gray-100">
              <button onClick={() => setDosyaUrl(null)} className="text-gray-400 text-lg leading-none px-2">×</button>
            </div>
            <iframe src={dosyaUrl} className="flex-1 border-0" title="Belge" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function EvrakOnayDetay({ personelId, adSoyad, onClose }: { personelId: string; adSoyad: string; onClose: () => void }) {
  const [detay, setDetay] = useState<EvrakDetay | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hatirlatmaGonderildi, setHatirlatmaGonderildi] = useState(false);

  useEffect(() => {
    getEvrakDetay(personelId).then((d) => { setDetay(d); setYukleniyor(false); });
  }, [personelId]);

  function karar(belgeId: string, kararDegeri: "ONAYLANDI" | "REDDEDILDI", redNedeni?: string, redAciklama?: string) {
    const fd = new FormData();
    fd.set("belge_id", belgeId);
    fd.set("karar", kararDegeri);
    if (redNedeni) fd.set("red_nedeni", redNedeni);
    if (redAciklama) fd.set("red_aciklama", redAciklama);
    belgeKararVer(fd).then(() => {
      getEvrakDetay(personelId).then(setDetay);
    });
  }

  function hatirlat() {
    const fd = new FormData();
    fd.set("personel_id", personelId);
    hatirlatmaGonder(fd).then((res) => { if (!res?.error) setHatirlatmaGonderildi(true); });
  }

  const gorunurBelgeler = BELGE_LISTESI.filter((b) => belgeGorunurMu(b, detay?.cinsiyet ?? null));

  return (
    <div className="fixed inset-0 bg-navy-3/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
          <div className="text-sm font-semibold text-navy-3">{adSoyad}</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div className="p-4 space-y-2.5">
          {yukleniyor ? (
            <div className="text-xs text-gray-400 py-8 text-center flex items-center justify-center gap-2">
              <span className="yukleniyor-donen" /> Yükleniyor...
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-1">
                <button onClick={hatirlat} disabled={hatirlatmaGonderildi}
                  className="text-[11px] text-info hover:underline disabled:opacity-50 disabled:no-underline">
                  {hatirlatmaGonderildi ? "Hatırlatma gönderildi ✓" : "Adaya Hatırlatma Gönder"}
                </button>
              </div>
              {gorunurBelgeler.map((tanim) => (
                <BelgeSatiri
                  key={tanim.id}
                  belgeTipi={tanim.id}
                  tanimAd={tanim.ad}
                  kayit={detay?.belgeler.find((b) => b.belge_tipi === tanim.id)}
                  onKarar={karar}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
