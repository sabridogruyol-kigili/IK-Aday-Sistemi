"use client";

import { useState, useTransition } from "react";
import { adayiHavuzdanYonlendir } from "./actions";
import CvGoruntuleyici from "./CvGoruntuleyici";

export default function HavuzKarti({
  adayId, adSoyad, telefon, email, cvLink, tcKimlikNo, havuzMagaza, aktifIseAlimTalepleri,
}: {
  adayId: string; adSoyad: string; telefon: string | null; email: string | null; cvLink: string | null;
  tcKimlikNo: string | null; havuzMagaza?: string;
  aktifIseAlimTalepleri: { id: string; talep_no: string; magaza_adi: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [cvAcik, setCvAcik] = useState(false);
  const [secilenTalepId, setSecilenTalepId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [basarili, setBasarili] = useState(false);

  function yonlendir() {
    if (!secilenTalepId) return;
    setError(null);
    const fd = new FormData();
    fd.set("aday_id", adayId);
    fd.set("yeni_talep_id", secilenTalepId);
    startTransition(async () => {
      const res = await adayiHavuzdanYonlendir(fd);
      if (res?.error) { setError(res.error); return; }
      setBasarili(true);
    });
  }

  if (basarili) {
    return (
      <div className="bg-success-bg border border-success/30 rounded-card p-3 text-xs text-success">
        {adSoyad} yeni talebe yönlendirildi — bu listeden kalktı, süreç sıfırdan başladı.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-card p-3">
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <div className="font-medium text-navy-3 text-sm">{adSoyad}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Son mağaza: {havuzMagaza ?? "—"} · {telefon ?? "Telefon —"} · {email ?? "E-posta —"}
          </div>
          {cvLink && (
            <button onClick={() => setCvAcik(true)} className="text-xs text-info hover:underline font-medium">CV Görüntüle</button>
          )}
          {cvAcik && cvLink && <CvGoruntuleyici cvYolu={cvLink} onClose={() => setCvAcik(false)} />}
        </div>
        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">Havuzda</span>
      </div>

      <div className="flex gap-2 mt-2">
        <select value={secilenTalepId} onChange={(e) => setSecilenTalepId(e.target.value)}
          className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
          <option value="">Bir İşe Alım talebi seçin...</option>
          {aktifIseAlimTalepleri.map((t) => (
            <option key={t.id} value={t.id}>{t.talep_no} — {t.magaza_adi}</option>
          ))}
        </select>
        <button onClick={yonlendir} disabled={pending || !secilenTalepId}
          className="bg-navy hover:bg-navy-2 text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-colors shrink-0">
          {pending ? "Gönderiliyor..." : "Bu Talebe Yönlendir"}
        </button>
      </div>
      {error && <div className="text-xs text-danger mt-1.5">{error}</div>}
    </div>
  );
}
