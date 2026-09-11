"use client";

import { useMemo, useState } from "react";
import { kvkkOnayla, bilgileriKaydet, belgeYukle, type PortalVerisi } from "./actions";
import { BELGE_LISTESI, belgeGorunurMu, ILLER, ILCE, RED_NEDENLERI, type BelgeTipi } from "@/lib/evrakSabitleri";
import PortalBaslik from "./PortalBaslik";

const DURUM_ROZET: Record<string, { etiket: string; sinif: string }> = {
  BEKLENIYOR: { etiket: "Bekleniyor", sinif: "bg-gray-100 text-gray-500" },
  INCELEMEDE: { etiket: "İncelemede", sinif: "bg-accent/15 text-accent" },
  ONAYLANDI: { etiket: "Onaylandı", sinif: "bg-success-bg text-success" },
  REDDEDILDI: { etiket: "Reddedildi — Tekrar Yükleyin", sinif: "bg-danger-bg text-danger" },
};

const ADIM_LISTESI = [
  { key: "bilgiler", no: 1, label: "Bilgileriniz" },
  { key: "belgeler", no: 2, label: "Belgeler" },
  { key: "hosgeldin", no: 3, label: "Hoş Geldiniz" },
] as const;
type AdimKey = typeof ADIM_LISTESI[number]["key"];

function AdimGostergesi({ aktif, tamamlanan, onGit }: { aktif: AdimKey; tamamlanan: AdimKey[]; onGit: (a: AdimKey) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      {ADIM_LISTESI.map((a, i) => {
        const durum = a.key === aktif ? "aktif" : tamamlanan.includes(a.key) ? "tamam" : "bekliyor";
        const tiklanabilir = durum === "tamam";
        return (
          <div key={a.key} className="flex items-center gap-1.5">
            <button
              onClick={() => tiklanabilir && onGit(a.key)}
              disabled={!tiklanabilir}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors ${
                durum === "aktif" ? "bg-navy text-white"
                : durum === "tamam" ? "bg-success-bg text-success cursor-pointer hover:opacity-80"
                : "bg-gray-100 text-gray-400 cursor-default"
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                durum === "aktif" ? "bg-white text-navy" : durum === "tamam" ? "bg-success text-white" : "bg-gray-300 text-white"
              }`}>
                {durum === "tamam" ? "✓" : a.no}
              </span>
              <span className="text-[10px] font-semibold hidden sm:inline">{a.label}</span>
            </button>
            {i < ADIM_LISTESI.length - 1 && <div className="w-3 h-px bg-gray-300" />}
          </div>
        );
      })}
    </div>
  );
}

function BelgeKarti({
  tanim, durum, onYukle, yukleniyorMu,
}: {
  tanim: typeof BELGE_LISTESI[number]; durum: PortalVerisi["belgeler"][BelgeTipi];
  onYukle: (dosyalar: FileList) => void; yukleniyorMu: boolean;
}) {
  const [detayAcik, setDetayAcik] = useState(false);
  const rozet = DURUM_ROZET[durum.durum] ?? DURUM_ROZET.BEKLENIYOR;

  return (
    <div className={`border rounded-card p-3.5 ${durum.durum === "ONAYLANDI" ? "border-success/30 bg-success-bg/20" : durum.durum === "REDDEDILDI" ? "border-danger/30 bg-danger-bg/20" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-navy-3">{tanim.ad}{tanim.istegeBagli && <span className="text-gray-400 font-normal"> (isteğe bağlı)</span>}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{tanim.etiket}</div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${rozet.sinif}`}>{rozet.etiket}</span>
      </div>

      {durum.durum === "REDDEDILDI" && (
        <div className="mt-2 bg-danger-bg text-danger text-[11px] rounded-md px-2.5 py-2">
          <strong>{durum.red_nedeni}</strong>{durum.red_aciklama && <> — {durum.red_aciklama}</>}
        </div>
      )}

      <button onClick={() => setDetayAcik(!detayAcik)} className="text-[11px] text-info hover:underline mt-2">
        {detayAcik ? "Nasıl alınır — gizle" : "Nasıl alınır?"}
      </button>
      {detayAcik && (
        <ol className="text-[11px] text-gray-600 mt-1.5 pl-4 list-decimal space-y-0.5">
          {tanim.nasilAlinir.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}

      {durum.durum !== "ONAYLANDI" && (
        <div className="mt-2.5">
          <label className="inline-block bg-navy hover:bg-navy-2 text-white text-[11px] font-medium rounded-md px-3 py-1.5 cursor-pointer transition-colors">
            {yukleniyorMu ? "Yükleniyor..." : durum.dosya_yollari.length > 0 ? "Yeniden Yükle" : "Dosya Seç ve Yükle"}
            <input type="file" multiple={tanim.coklu} accept="image/*,.pdf" className="hidden" disabled={yukleniyorMu}
              onChange={(e) => e.target.files && e.target.files.length > 0 && onYukle(e.target.files)} />
          </label>
          {durum.dosya_yollari.length > 0 && (
            <span className="text-[11px] text-gray-400 ml-2">{durum.dosya_yollari.length} dosya yüklü</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function EvrakPortaliClient({ token, kod, veri }: { token: string; kod: string; veri: PortalVerisi }) {
  const [bilgiler, setBilgiler] = useState(veri.bilgiler ?? {});
  const [belgeler, setBelgeler] = useState(veri.belgeler);
  const [kvkkOnaylandi, setKvkkOnaylandi] = useState(!!veri.bilgiler?.kvkk_onay_tarihi);
  const [kvkkIsaretli, setKvkkIsaretli] = useState(false);
  const [kvkkPending, setKvkkPending] = useState(false);

  const [bilgilerKaydediliyor, setBilgilerKaydediliyor] = useState(false);
  const [bilgilerHata, setBilgilerHata] = useState<string | null>(null);
  const [bilgilerKaydedildi, setBilgilerKaydedildi] = useState(!!veri.bilgiler);

  const [yukleyenBelge, setYukleyenBelge] = useState<BelgeTipi | null>(null);
  const [yuklemeHata, setYuklemeHata] = useState<string | null>(null);

  const [adim, setAdim] = useState<AdimKey>("bilgiler");

  const cinsiyet = bilgiler.cinsiyet ?? null;
  const gorunurBelgeler = useMemo(() => BELGE_LISTESI.filter((b) => belgeGorunurMu(b, cinsiyet)), [cinsiyet]);
  const zorunluBelgeler = useMemo(() => gorunurBelgeler.filter((b) => !b.istegeBagli), [gorunurBelgeler]);
  const tamamlananSayisi = zorunluBelgeler.filter((b) => belgeler[b.id]?.durum === "ONAYLANDI" || belgeler[b.id]?.durum === "INCELEMEDE").length;
  const belgelerTamam = zorunluBelgeler.length > 0 && tamamlananSayisi === zorunluBelgeler.length;

  const tamamlananAdimlar: AdimKey[] = [];
  if (bilgilerKaydedildi) tamamlananAdimlar.push("bilgiler");
  if (belgelerTamam) tamamlananAdimlar.push("belgeler");

  function kvkkOnaylaTikla() {
    setKvkkPending(true);
    kvkkOnayla(token, kod).then((res) => {
      setKvkkPending(false);
      if (!res?.error) setKvkkOnaylandi(true);
    });
  }

  function bilgileriKaydetTikla(formData: FormData) {
    setBilgilerHata(null);
    setBilgilerKaydediliyor(true);
    bilgileriKaydet(token, kod, formData).then((res) => {
      setBilgilerKaydediliyor(false);
      if (res?.error) { setBilgilerHata(res.error); return; }
      const yeni: any = {};
      formData.forEach((v, k) => { yeni[k] = v; });
      setBilgiler((b: any) => ({ ...b, ...yeni }));
      setBilgilerKaydedildi(true);
      setAdim("belgeler");
    });
  }

  function belgeYukleTikla(belgeTipi: BelgeTipi, dosyalar: FileList) {
    setYuklemeHata(null);
    setYukleyenBelge(belgeTipi);
    const fd = new FormData();
    fd.set("belge_tipi", belgeTipi);
    Array.from(dosyalar).forEach((f) => fd.append("dosyalar", f));
    belgeYukle(token, kod, fd).then((res) => {
      setYukleyenBelge(null);
      if (res?.error) { setYuklemeHata(res.error); return; }
      setBelgeler((b) => ({ ...b, [belgeTipi]: { ...b[belgeTipi], durum: "INCELEMEDE", dosya_yollari: ["yuklendi"] } }));
    });
  }

  if (!kvkkOnaylandi) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <PortalBaslik />
          <div className="bg-white border border-gray-200 rounded-card p-6">
          <div className="text-sm font-semibold text-navy-3 mb-1">Merhaba {veri.ad_soyad},</div>
          <div className="text-xs text-gray-500 mb-4">İşe giriş evraklarınızı buradan kolayca tamamlayabilirsiniz. Devam etmeden önce aşağıdaki metni okuyup onaylamanız gerekiyor.</div>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-[11px] text-gray-600 max-h-56 overflow-y-auto mb-3 leading-relaxed">
            <strong>Aydınlatma Metni ve Açık Rıza</strong><br />
            Bu portal üzerinden toplanan kimlik, iletişim, adres ve durum bilgileriniz ile yüklediğiniz belgeler, işe giriş sürecinizin tamamlanması amacıyla İnsan Kaynakları tarafından işlenecektir. Sağlık raporu ve adli sicil kaydı gibi özel nitelikli kişisel verileriniz, yalnızca yasal yükümlülüklerin yerine getirilmesi amacıyla, gerekli teknik ve idari tedbirler alınarak işlenir. Verileriniz, kurumsal sisteme aktarıldıktan sonra bu portalda kalıcı olarak saklanmaz. Devam ederek, kişisel verilerinizin belirtilen amaçlarla işlenmesine açık rıza vermiş olursunuz.
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-600 mb-4">
            <input type="checkbox" checked={kvkkIsaretli} onChange={(e) => setKvkkIsaretli(e.target.checked)} className="mt-0.5" />
            Aydınlatma metnini okudum, kişisel verilerimin ve özel nitelikli kişisel verilerimin işlenmesine açık rıza veriyorum.
          </label>

          <button onClick={kvkkOnaylaTikla} disabled={!kvkkIsaretli || kvkkPending}
            className="w-full bg-navy hover:bg-navy-2 text-white rounded-md py-2.5 text-sm font-medium disabled:opacity-40 transition-colors">
            {kvkkPending ? "Kaydediliyor..." : "Onaylıyorum, Devam Et"}
          </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] p-4">
      <div className="max-w-md mx-auto space-y-4 pb-8">
        <PortalBaslik />
        <AdimGostergesi aktif={adim} tamamlanan={tamamlananAdimlar} onGit={setAdim} />

        <div className="bg-navy rounded-card p-4 text-white">
          <div className="text-sm font-semibold">Merhaba {veri.ad_soyad}</div>
          <div className="text-[11px] text-white/60 mt-0.5">İşe giriş evrak süreciniz</div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] mb-1">
              <span>Belge Durumu</span>
              <span>{tamamlananSayisi} / {zorunluBelgeler.length}</span>
            </div>
            <div className="bg-white/15 rounded-full h-1.5 overflow-hidden">
              <div className="bg-white h-full rounded-full transition-all" style={{ width: `${zorunluBelgeler.length > 0 ? (tamamlananSayisi / zorunluBelgeler.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        {adim === "bilgiler" && (
          <div className="bg-white border border-gray-200 rounded-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-navy-3">Bilgileriniz</div>
              {bilgilerKaydedildi && <span className="text-[10px] bg-success-bg text-success px-2 py-0.5 rounded-full">Kaydedildi</span>}
            </div>

            <form action={bilgileriKaydetTikla} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Cinsiyet *</label>
                  <select name="cinsiyet" required defaultValue={bilgiler.cinsiyet ?? ""} className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white">
                    <option value="">Seçin</option>
                    <option value="Kadın">Kadın</option>
                    <option value="Erkek">Erkek</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Medeni Hal *</label>
                  <select name="medeni_hal" required defaultValue={bilgiler.medeni_hal ?? ""} className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white">
                    <option value="">Seçin</option>
                    <option value="Bekâr">Bekâr</option>
                    <option value="Evli">Evli</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Emeklilik Durumu</label>
                  <select name="emekli" defaultValue={String(bilgiler.emekli ?? false)} className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white">
                    <option value="false">Emekli değilim</option>
                    <option value="true">Emekliyim</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Engellilik Durumu</label>
                  <select name="engelli" defaultValue={String(bilgiler.engelli ?? false)} className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white">
                    <option value="false">Yok</option>
                    <option value="true">Var</option>
                  </select>
                  <div className="text-[10px] text-gray-400 mt-1">Cevabınız işe alım kararınızı etkilemez.</div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">IBAN</label>
                <input name="iban" defaultValue={bilgiler.iban ?? ""} placeholder="TR.. .. .... .... .... .... .."
                  className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm font-mono" />
              </div>

              <div className="pt-2 border-t border-gray-100">
                <div className="text-[11px] font-semibold text-navy-3 mb-2">İkamet Adresi</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select name="il" required defaultValue={bilgiler.il ?? ""} className="border border-gray-300 rounded-md px-2 py-2 text-sm bg-white">
                    <option value="">İl seçin</option>
                    {ILLER.map((il) => <option key={il} value={il}>{il}</option>)}
                  </select>
                  <select name="ilce" required defaultValue={bilgiler.ilce ?? ""} className="border border-gray-300 rounded-md px-2 py-2 text-sm bg-white">
                    <option value="">İlçe seçin</option>
                    {(ILCE[bilgiler.il] ?? "").split(",").filter(Boolean).map((i: string) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <input name="mahalle" defaultValue={bilgiler.mahalle ?? ""} placeholder="Mahalle / Köy" className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm mb-2" />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input name="cadde" defaultValue={bilgiler.cadde ?? ""} placeholder="Cadde" className="border border-gray-300 rounded-md px-2 py-2 text-sm" />
                  <input name="sokak" defaultValue={bilgiler.sokak ?? ""} placeholder="Sokak" className="border border-gray-300 rounded-md px-2 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input name="bina_no" defaultValue={bilgiler.bina_no ?? ""} placeholder="Bina No" className="border border-gray-300 rounded-md px-2 py-2 text-sm" />
                  <input name="daire_no" defaultValue={bilgiler.daire_no ?? ""} placeholder="Daire No" className="border border-gray-300 rounded-md px-2 py-2 text-sm" />
                </div>
              </div>

              {bilgilerHata && <div className="text-xs text-danger">{bilgilerHata}</div>}

              <button type="submit" disabled={bilgilerKaydediliyor}
                className="w-full bg-navy hover:bg-navy-2 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50 transition-colors">
                {bilgilerKaydediliyor ? "Kaydediliyor..." : bilgilerKaydedildi ? "Kaydet ve Devam Et →" : "Bilgileri Kaydet ve Devam Et"}
              </button>
            </form>
          </div>
        )}

        {adim === "belgeler" && (
          <>
            <div>
              <div className="text-sm font-semibold text-navy-3 mb-2 px-1">Belgeler</div>
              <div className="space-y-2.5">
                {gorunurBelgeler.map((tanim) => (
                  <BelgeKarti
                    key={tanim.id}
                    tanim={tanim}
                    durum={belgeler[tanim.id]}
                    onYukle={(dosyalar) => belgeYukleTikla(tanim.id, dosyalar)}
                    yukleniyorMu={yukleyenBelge === tanim.id}
                  />
                ))}
              </div>
              {yuklemeHata && <div className="text-xs text-danger mt-2">{yuklemeHata}</div>}
            </div>

            <button onClick={() => setAdim("hosgeldin")} disabled={!belgelerTamam}
              className="w-full bg-navy hover:bg-navy-2 text-white rounded-md py-2.5 text-sm font-medium disabled:opacity-40 transition-colors">
              {belgelerTamam ? "Devam Et →" : `Devam etmek için tüm zorunlu belgeleri yükleyin (${tamamlananSayisi}/${zorunluBelgeler.length})`}
            </button>
          </>
        )}

        {adim === "hosgeldin" && (
          <>
            <div className="bg-white border border-gray-200 rounded-card p-6 text-center">
              <div className="text-2xl mb-2">🎉</div>
              <div className="text-base font-semibold text-navy-3 mb-1">Hayırlı Olsun!</div>
              <div className="text-xs text-gray-500 leading-relaxed">
                Aramıza katılacağınız için çok mutluyuz. Süreciniz tamamlandı — aşağıdaki bilgiler işe başlangıcınız için size yardımcı olacak.
              </div>
            </div>

            {(veri.magazaAdi || veri.magazaAdres) && (
              <div className="bg-white border border-gray-200 rounded-card p-4">
                <div className="text-sm font-semibold text-navy-3 mb-2">Başlayacağınız Mağaza</div>
                {veri.magazaAdi && <div className="text-sm text-navy-3 font-medium mb-1">{veri.magazaAdi}</div>}
                {veri.magazaAdres && <div className="text-[12px] text-gray-500 leading-relaxed mb-2">{veri.magazaAdres}</div>}
                {veri.magazaKonumLink && (
                  <a href={veri.magazaKonumLink} target="_blank" rel="noopener noreferrer"
                    className="inline-block bg-navy hover:bg-navy-2 text-white text-[12px] font-medium rounded-md px-3 py-1.5 transition-colors">
                    Konumu Haritada Gör
                  </a>
                )}
              </div>
            )}

            {veri.egitimLinkleri.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-card p-4">
                <div className="text-sm font-semibold text-navy-3 mb-1">Zorunlu Eğitimler</div>
                <div className="text-[11px] text-gray-500 mb-3">İşe başlamadan önce izlemeniz gereken zorunlu eğitimler.</div>
                <div className="space-y-2">
                  {veri.egitimLinkleri.map((e) => (
                    <a key={e.id} href={e.link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-md px-3 py-2.5 text-[13px] text-navy-3 font-medium transition-colors">
                      {e.baslik}
                      <span className="text-info text-[11px]">İzle →</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="text-center text-[10px] text-gray-400 pt-2">
          Bu sayfayı istediğiniz zaman kapatıp aynı bağlantıdan devam edebilirsiniz.
        </div>

        <div className="bg-navy rounded-card overflow-hidden">
          <div className="bg-white/10 px-4 py-2.5 text-center">
            <div className="text-[10px] text-white/70 uppercase tracking-wide font-semibold">Yardıma mı ihtiyacınız var?</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[11px] text-white/80 text-center mb-3">
              Takıldığınız bir yer olursa İnsan Kaynakları'na ulaşın.
            </div>
            <div className="space-y-2">
              {veri.ikWebsite && (
                <div className="flex items-start gap-2">
                  <span className="text-[9px] text-white/50 uppercase tracking-wide w-12 shrink-0 pt-0.5">Web</span>
                  <span className="text-[12px] text-white font-medium">{veri.ikWebsite}</span>
                </div>
              )}
              {veri.ikEmail && (
                <div className="flex items-start gap-2">
                  <span className="text-[9px] text-white/50 uppercase tracking-wide w-12 shrink-0 pt-0.5">Mail</span>
                  <span className="text-[12px] text-white font-medium">{veri.ikEmail}</span>
                </div>
              )}
              {veri.ikAdres && (
                <div className="flex items-start gap-2">
                  <span className="text-[9px] text-white/50 uppercase tracking-wide w-12 shrink-0 pt-0.5">Adres</span>
                  <span className="text-[11.5px] text-white/90 leading-relaxed">{veri.ikAdres}</span>
                </div>
              )}
              {veri.ikCalismaSaatleri && (
                <div className="flex items-start gap-2">
                  <span className="text-[9px] text-white/50 uppercase tracking-wide w-12 shrink-0 pt-0.5">Saatler</span>
                  <span className="text-[11.5px] text-white/90">{veri.ikCalismaSaatleri}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
