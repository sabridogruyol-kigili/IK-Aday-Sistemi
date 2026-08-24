"use client";

import { useRef, useState, useTransition } from "react";
import { yonlendirAday, getAdaylarByTalep, deleteAday, kararVerAday, ilerletDurum } from "../adaylar/actions";
import { createClient } from "@/lib/supabase/client";

const DURUM_ETIKET: Record<string, string> = {
  YONLENDIRILDI: "Yönlendirildi",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
  ON_GORUSME_PLANLANDI: "Ön Görüşme Planlandı",
  GORUSULDU_OLUMLU: "Görüşüldü — Olumlu",
  GORUSULDU_OLUMSUZ: "Görüşüldü — Olumsuz",
  ISE_ALINDI: "İşe Alındı",
};

const DURUM_RENK: Record<string, string> = {
  YONLENDIRILDI: "bg-accent/10 text-accent",
  ONAYLANDI: "bg-success-bg text-success",
  REDDEDILDI: "bg-danger-bg text-danger",
  ON_GORUSME_PLANLANDI: "bg-info-bg text-info",
  GORUSULDU_OLUMLU: "bg-success-bg text-success",
  GORUSULDU_OLUMSUZ: "bg-danger-bg text-danger",
  ISE_ALINDI: "bg-success text-white",
};

type Aday = {
  id: string; ad_soyad: string; cv_drive_link: string | null;
  yonlendiren_rol: string; karari_veren_rol: string; durum: string; yonlendiren_kullanici_id: string;
};

export default function AdayPanel({ talepId, benimKullaniciId, benimRolum }: { talepId: string; benimKullaniciId: string; benimRolum: string }) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [adaylar, setAdaylar] = useState<Aday[]>([]);
  const [pending, startTransition] = useTransition();
  const [yeniAd, setYeniAd] = useState("");
  const [yuklenenDosyaYolu, setYuklenenDosyaYolu] = useState<string | null>(null);
  const [yuklenenDosyaAdi, setYuklenenDosyaAdi] = useState<string | null>(null);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const [yukleniyorMu, setYukleniyorMu] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function yukle() {
    startTransition(async () => {
      const res = await getAdaylarByTalep(talepId);
      setAdaylar(res.data as Aday[]);
    });
  }

  function toggle() {
    if (!open) yukle();
    setOpen(!open);
  }

  async function dosyaYukle(file: File) {
    setHata(null);
    if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type)) {
      setHata("Sadece PDF veya Word dosyası yükleyebilirsiniz.");
      return;
    }
    setYukleniyorMu(true);
    const yol = `${talepId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("cv-dosyalar").upload(yol, file);
    setYukleniyorMu(false);
    if (error) {
      setHata("Yükleme başarısız: " + error.message);
      return;
    }
    setYuklenenDosyaYolu(yol);
    setYuklenenDosyaAdi(file.name);
  }

  function ekle() {
    if (!yeniAd.trim()) return;
    const fd = new FormData();
    fd.set("talep_id", talepId);
    fd.set("ad_soyad", yeniAd);
    fd.set("cv_drive_link", yuklenenDosyaYolu ?? "");
    startTransition(async () => {
      await yonlendirAday(fd);
      setYeniAd(""); setYuklenenDosyaYolu(null); setYuklenenDosyaAdi(null);
      yukle();
    });
  }

  async function cvGoster(yol: string) {
    const { data, error } = await supabase.storage.from("cv-dosyalar").createSignedUrl(yol, 60);
    if (error || !data) { alert("CV açılamadı: " + error?.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  function sil(adayId: string) {
    const fd = new FormData();
    fd.set("aday_id", adayId);
    startTransition(async () => { await deleteAday(fd); yukle(); });
  }

  function karar(adayId: string, k: "ONAY" | "RED", aciklama?: string) {
    const fd = new FormData();
    fd.set("aday_id", adayId); fd.set("karar", k); fd.set("aciklama", aciklama ?? "");
    startTransition(async () => { await kararVerAday(fd); yukle(); });
  }

  function ilerlet(adayId: string, yeniDurum: string, tcKimlik?: string) {
    const fd = new FormData();
    fd.set("aday_id", adayId); fd.set("yeni_durum", yeniDurum);
    if (tcKimlik) fd.set("tc_kimlik_no", tcKimlik);
    startTransition(async () => { await ilerletDurum(fd); yukle(); });
  }

  return (
    <div>
      <button onClick={toggle} className="text-xs text-info font-medium hover:underline flex items-center gap-1">
        Adaylar {open ? "▲" : "▼"}
      </button>

      {open && (
        <div className="mt-2 border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4 max-w-md shadow-sm">

          {/* Yeni aday ekleme */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide">Yeni Aday Ekle</div>
            <input
              value={yeniAd}
              onChange={(e) => setYeniAd(e.target.value)}
              placeholder="Aday adı soyadı"
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
            />

            <div
              onDragOver={(e) => { e.preventDefault(); setSurukleniyor(true); }}
              onDragLeave={() => setSurukleniyor(false)}
              onDrop={(e) => {
                e.preventDefault();
                setSurukleniyor(false);
                const file = e.dataTransfer.files?.[0];
                if (file) dosyaYukle(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
                surukleniyor ? "border-navy bg-info-bg" : "border-gray-300 hover:border-navy hover:bg-gray-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) dosyaYukle(f); }}
              />
              {yukleniyorMu ? (
                <div className="text-xs text-gray-400">Yükleniyor...</div>
              ) : yuklenenDosyaAdi ? (
                <div className="text-xs text-success font-medium">✓ {yuklenenDosyaAdi}</div>
              ) : (
                <>
                  <div className="text-lg mb-1">📄</div>
                  <div className="text-xs text-gray-400">CV'yi sürükleyip bırakın ya da tıklayın (PDF/Word)</div>
                </>
              )}
            </div>

            {hata && <div className="text-[11px] text-danger">{hata}</div>}

            <button
              onClick={ekle}
              disabled={pending || !yeniAd.trim()}
              className="w-full bg-navy text-white rounded-md py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Ekle
            </button>
          </div>

          {/* Aday listesi */}
          {adaylar.length === 0 && <div className="text-xs text-gray-400 text-center py-2">Henüz aday yok.</div>}

          <div className="space-y-2">
            {adaylar.map((a) => {
              const benKararVerebilirim = a.durum === "YONLENDIRILDI" && (benimRolum === a.karari_veren_rol || benimRolum === "YONETIM");
              const benSilebilirim = a.durum === "YONLENDIRILDI" && (a.yonlendiren_kullanici_id === benimKullaniciId || benimRolum === "YONETIM");
              return (
                <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-navy-3 text-sm">{a.ad_soyad}</div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DURUM_RENK[a.durum] ?? ""}`}>
                      {DURUM_ETIKET[a.durum]}
                    </span>
                  </div>
                  {a.cv_drive_link && (
                    <button onClick={() => cvGoster(a.cv_drive_link!)} className="text-[11px] text-info underline">
                      📎 CV'yi Görüntüle
                    </button>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {benKararVerebilirim && (
                      <>
                        <button onClick={() => karar(a.id, "ONAY")} className="bg-success text-white rounded-md px-2.5 py-1 text-[11px] font-medium">Onayla</button>
                        <button onClick={() => {
                          const aciklama = prompt("Red gerekçesi:");
                          if (aciklama) karar(a.id, "RED", aciklama);
                        }} className="bg-danger-bg text-danger border border-danger/30 rounded-md px-2.5 py-1 text-[11px] font-medium">Reddet</button>
                      </>
                    )}
                    {a.durum === "ONAYLANDI" && (
                      <button onClick={() => ilerlet(a.id, "ON_GORUSME_PLANLANDI")} className="bg-info text-white rounded-md px-2.5 py-1 text-[11px] font-medium">Ön Görüşme</button>
                    )}
                    {a.durum === "ON_GORUSME_PLANLANDI" && (
                      <>
                        <button onClick={() => ilerlet(a.id, "GORUSULDU_OLUMLU")} className="bg-success text-white rounded-md px-2.5 py-1 text-[11px] font-medium">Olumlu</button>
                        <button onClick={() => ilerlet(a.id, "GORUSULDU_OLUMSUZ")} className="bg-danger text-white rounded-md px-2.5 py-1 text-[11px] font-medium">Olumsuz</button>
                      </>
                    )}
                    {a.durum === "GORUSULDU_OLUMLU" && (
                      <button onClick={() => {
                        const tc = prompt("TC Kimlik No:");
                        if (tc) ilerlet(a.id, "ISE_ALINDI", tc);
                      }} className="bg-success text-white rounded-md px-2.5 py-1 text-[11px] font-medium">İşe Al</button>
                    )}
                    {benSilebilirim && (
                      <button onClick={() => sil(a.id)} className="bg-gray-100 text-gray-500 rounded-md px-2.5 py-1 text-[11px] font-medium ml-auto">Sil</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
