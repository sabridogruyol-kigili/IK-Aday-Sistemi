"use client";

import { useEffect, useState } from "react";
import { getEvrakDetay, belgeKararVer, getBelgeSignedUrl, hatirlatmaGonder, iptalEtIseAlim, type EvrakDetay } from "./actions";
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
  const [hatirlatmaHata, setHatirlatmaHata] = useState<string | null>(null);
  const [iptalModAcik, setIptalModAcik] = useState(false);
  const [iptalNedeni, setIptalNedeni] = useState("");
  const [iptalPending, setIptalPending] = useState(false);
  const [iptalHata, setIptalHata] = useState<string | null>(null);
  const [iptalEdildi, setIptalEdildi] = useState(false);

  useEffect(() => {
    getEvrakDetay(personelId).then((d) => { setDetay(d); setYukleniyor(false); });
  }, [personelId]);

  function iptalEt() {
    setIptalHata(null);
    setIptalPending(true);
    const fd = new FormData();
    fd.set("personel_id", personelId);
    fd.set("neden", iptalNedeni);
    iptalEtIseAlim(fd).then((res) => {
      setIptalPending(false);
      if (res?.error) { setIptalHata(res.error); return; }
      setIptalEdildi(true);
    });
  }

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
    setHatirlatmaHata(null);
    const fd = new FormData();
    fd.set("personel_id", personelId);
    hatirlatmaGonder(fd).then((res) => {
      if (res?.error) setHatirlatmaHata(res.error);
      else setHatirlatmaGonderildi(true);
    });
  }

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

  function tarihFormat(t: string | null): string {
    if (!t) return "—";
    const d = new Date(t);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const gorunurBelgeler = BELGE_LISTESI.filter((b) => belgeGorunurMu(b, detay?.cinsiyet ?? null));
  const yas = yasHesapla(detay?.dogum_tarihi ?? null);

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
          ) : iptalEdildi ? (
            <div className="text-center py-6">
              <div className="text-sm font-semibold text-danger mb-1">İşe Alım İptal Edildi</div>
              <div className="text-xs text-gray-500">{adSoyad} pasif duruma alındı, evrak süreci sonlandırıldı.</div>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 rounded-md p-3 mb-1">
                <div className="text-[10px] font-semibold text-navy-3 uppercase mb-2">Kişi Bilgileri</div>
                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <div><span className="text-gray-400">E-posta: </span><span className="text-navy-3">{detay?.email ?? "—"}</span></div>
                  <div><span className="text-gray-400">Cinsiyet: </span><span className="text-navy-3">{detay?.cinsiyet ?? "—"}</span></div>
                  <div><span className="text-gray-400">Doğum Tarihi: </span><span className="text-navy-3">{tarihFormat(detay?.dogum_tarihi ?? null)}</span></div>
                  <div><span className="text-gray-400">Yaş: </span><span className="text-navy-3">{yas ?? "—"}</span></div>
                  <div><span className="text-gray-400">Medeni Hal: </span><span className="text-navy-3">{detay?.medeni_hal ?? "—"}</span></div>
                  <div><span className="text-gray-400">IBAN: </span><span className="text-navy-3 font-mono">{detay?.iban ?? "—"}</span></div>
                </div>
              </div>

              {!iptalModAcik ? (
                <div className="flex items-center justify-between gap-2 mb-1">
                  <button onClick={() => setIptalModAcik(true)}
                    className="text-[11px] font-medium rounded-md px-3 py-1.5 bg-white border border-danger/30 text-danger hover:bg-danger-bg transition-colors">
                    İşe Alımı İptal Et
                  </button>
                  <button onClick={hatirlat} disabled={hatirlatmaGonderildi}
                    className={`text-[11px] font-medium rounded-md px-3 py-1.5 transition-colors ${
                      hatirlatmaGonderildi
                        ? "bg-success-bg text-success cursor-default"
                        : "bg-white border border-info/40 text-info hover:bg-info/5"
                    }`}>
                    {hatirlatmaGonderildi ? "Hatırlatma Gönderildi ✓" : "Adaya Hatırlatma Gönder"}
                  </button>
                </div>
              ) : (
                <div className="bg-danger-bg border border-danger/30 rounded-md p-3 mb-1">
                  <div className="text-[11px] font-semibold text-danger mb-1.5">İşe Alımı İptal Et</div>
                  <div className="text-[11px] text-gray-600 mb-2">
                    Bu kişi pasif duruma alınacak, evrak süreci sonlandırılacak. Bu işlem geri alınamaz.
                  </div>
                  <textarea value={iptalNedeni} onChange={(e) => setIptalNedeni(e.target.value)}
                    placeholder="İptal gerekçesi (en az 20 karakter)..." rows={2}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs mb-2" />
                  {iptalHata && <div className="text-[11px] text-danger mb-2">{iptalHata}</div>}
                  <div className="flex justify-between">
                    <button onClick={iptalEt} disabled={iptalPending || iptalNedeni.trim().length < 20}
                      className="bg-danger text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                      {iptalPending ? "İptal Ediliyor..." : "İptali Onayla"}
                    </button>
                    <button onClick={() => { setIptalModAcik(false); setIptalNedeni(""); setIptalHata(null); }} className="text-xs text-gray-400">
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
              {hatirlatmaHata && <div className="text-[11px] text-danger mb-1">{hatirlatmaHata}</div>}
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
