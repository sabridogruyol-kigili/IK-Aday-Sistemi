"use client";

import { useState, useTransition } from "react";
import { yonlendirAday, getAdaylarByTalep, deleteAday, kararVerAday, ilerletDurum } from "../adaylar/actions";

const DURUM_ETIKET: Record<string, string> = {
  YONLENDIRILDI: "Yönlendirildi",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
  ON_GORUSME_PLANLANDI: "Ön Görüşme Planlandı",
  GORUSULDU_OLUMLU: "Görüşüldü — Olumlu",
  GORUSULDU_OLUMSUZ: "Görüşüldü — Olumsuz",
  ISE_ALINDI: "İşe Alındı",
};

type Aday = {
  id: string; ad_soyad: string; cv_drive_link: string | null;
  yonlendiren_rol: string; karari_veren_rol: string; durum: string; yonlendiren_kullanici_id: string;
};

export default function AdayPanel({ talepId, benimKullaniciId, benimRolum }: { talepId: string; benimKullaniciId: string; benimRolum: string }) {
  const [open, setOpen] = useState(false);
  const [adaylar, setAdaylar] = useState<Aday[]>([]);
  const [pending, startTransition] = useTransition();
  const [yeniAd, setYeniAd] = useState("");
  const [yeniCv, setYeniCv] = useState("");

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

  function ekle() {
    const fd = new FormData();
    fd.set("talep_id", talepId);
    fd.set("ad_soyad", yeniAd);
    fd.set("cv_drive_link", yeniCv);
    startTransition(async () => {
      await yonlendirAday(fd);
      setYeniAd(""); setYeniCv("");
      yukle();
    });
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
      <button onClick={toggle} className="text-xs text-info underline">
        Adaylar {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-2 border border-gray-200 rounded-md p-3 bg-gray-50 space-y-3 max-w-md">
          <div className="flex gap-2">
            <input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Aday adı soyadı"
              className="border border-gray-300 rounded-md px-2 py-1 text-xs flex-1" />
            <input value={yeniCv} onChange={(e) => setYeniCv(e.target.value)} placeholder="CV linki (opsiyonel)"
              className="border border-gray-300 rounded-md px-2 py-1 text-xs flex-1" />
            <button onClick={ekle} disabled={pending || !yeniAd.trim()}
              className="bg-navy text-white rounded-md px-3 py-1 text-xs disabled:opacity-50">Ekle</button>
          </div>

          {adaylar.length === 0 && <div className="text-xs text-gray-400">Henüz aday yok.</div>}

          {adaylar.map((a) => {
            const benKararVerebilirim = a.durum === "YONLENDIRILDI" && (benimRolum === a.karari_veren_rol || benimRolum === "YONETIM");
            const benSilebilirim = a.durum === "YONLENDIRILDI" && (a.yonlendiren_kullanici_id === benimKullaniciId || benimRolum === "YONETIM");
            return (
              <div key={a.id} className="bg-white border border-gray-200 rounded-md p-2 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-navy-3">{a.ad_soyad}</div>
                  <span className="text-gray-500">{DURUM_ETIKET[a.durum]}</span>
                </div>
                {a.cv_drive_link && <a href={a.cv_drive_link} target="_blank" className="text-info underline block">CV</a>}

                <div className="flex flex-wrap gap-1.5">
                  {benKararVerebilirim && (
                    <>
                      <button onClick={() => karar(a.id, "ONAY")} className="bg-success text-white rounded px-2 py-0.5">Onayla</button>
                      <button onClick={() => {
                        const aciklama = prompt("Red gerekçesi:");
                        if (aciklama) karar(a.id, "RED", aciklama);
                      }} className="bg-danger-bg text-danger border border-danger/30 rounded px-2 py-0.5">Reddet</button>
                    </>
                  )}
                  {a.durum === "ONAYLANDI" && (
                    <button onClick={() => ilerlet(a.id, "ON_GORUSME_PLANLANDI")} className="bg-info text-white rounded px-2 py-0.5">Ön Görüşme</button>
                  )}
                  {a.durum === "ON_GORUSME_PLANLANDI" && (
                    <>
                      <button onClick={() => ilerlet(a.id, "GORUSULDU_OLUMLU")} className="bg-success text-white rounded px-2 py-0.5">Olumlu</button>
                      <button onClick={() => ilerlet(a.id, "GORUSULDU_OLUMSUZ")} className="bg-danger text-white rounded px-2 py-0.5">Olumsuz</button>
                    </>
                  )}
                  {a.durum === "GORUSULDU_OLUMLU" && (
                    <button onClick={() => {
                      const tc = prompt("TC Kimlik No:");
                      if (tc) ilerlet(a.id, "ISE_ALINDI", tc);
                    }} className="bg-success text-white rounded px-2 py-0.5">İşe Al</button>
                  )}
                  {benSilebilirim && (
                    <button onClick={() => sil(a.id)} className="bg-gray-100 text-gray-600 rounded px-2 py-0.5">Sil</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
