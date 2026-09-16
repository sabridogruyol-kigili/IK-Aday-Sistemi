"use client";

import { useState } from "react";
import { profilDegisiklikOnayla, profilDegisiklikReddet, type BekleyenProfilTalebi } from "../ProfilActions";

export default function ProfilTalepleriListesi({ talepler }: { talepler: BekleyenProfilTalebi[] }) {
  const [liste, setListe] = useState(talepler);
  const [redModAcikId, setRedModAcikId] = useState<string | null>(null);
  const [redNedeni, setRedNedeni] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  function onayla(id: string) {
    setPendingId(id);
    setHata(null);
    profilDegisiklikOnayla(id).then((res) => {
      setPendingId(null);
      if (res.error) { setHata(res.error); return; }
      setListe((l) => l.filter((t) => t.id !== id));
    });
  }

  function reddet(id: string) {
    if (redNedeni.trim().length < 5) { setHata("Red nedeni en az 5 karakter olmalı."); return; }
    setPendingId(id);
    setHata(null);
    profilDegisiklikReddet(id, redNedeni).then((res) => {
      setPendingId(null);
      if (res.error) { setHata(res.error); return; }
      setListe((l) => l.filter((t) => t.id !== id));
      setRedModAcikId(null);
      setRedNedeni("");
    });
  }

  if (liste.length === 0) return null;

  return (
    <div className="space-y-2">
      {hata && <div className="text-[11px] text-danger bg-danger-bg rounded-md px-3 py-2">{hata}</div>}
      {liste.map((t) => {
        const p = t.yeni_veri;
        return (
          <div key={t.id} className="bg-white border border-accent/30 rounded-card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-navy-3">{t.ad_soyad}</div>
              <div className="text-[10px] text-gray-400">{new Date(t.created_at).toLocaleString("tr-TR")}</div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mb-2">
              {p.email && <div><span className="text-gray-400">E-posta:</span> <span className="text-navy-3">{p.email}</span></div>}
              {p.telefon && <div><span className="text-gray-400">Telefon:</span> <span className="text-navy-3">{p.telefon}</span></div>}
              {p.egitim_duzeyi && <div><span className="text-gray-400">Eğitim:</span> <span className="text-navy-3">{p.egitim_duzeyi}</span></div>}
              {p.okul && <div><span className="text-gray-400">Okul:</span> <span className="text-navy-3">{p.okul}</span></div>}
              {p.bolum && <div><span className="text-gray-400">Bölüm:</span> <span className="text-navy-3">{p.bolum}</span></div>}
              {p.adres && <div className="col-span-2"><span className="text-gray-400">Adres:</span> <span className="text-navy-3">{p.adres}</span></div>}
              {p.sertifikalar.length > 0 && <div className="col-span-2"><span className="text-gray-400">Sertifikalar:</span> <span className="text-navy-3">{p.sertifikalar.join(", ")}</span></div>}
              {p.profil_foto_url && <div className="col-span-2"><span className="text-gray-400">Profil fotoğrafı değişikliği var.</span></div>}
            </div>

            {redModAcikId === t.id ? (
              <div className="bg-danger-bg rounded-md p-2 mt-2">
                <textarea value={redNedeni} onChange={(e) => setRedNedeni(e.target.value)} rows={2}
                  placeholder="Red nedeni (en az 5 karakter)..." className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs resize-none" />
                <div className="flex gap-2 mt-1.5">
                  <button onClick={() => reddet(t.id)} disabled={pendingId === t.id}
                    className="text-[11px] font-medium bg-danger text-white rounded-md px-2.5 py-1 disabled:opacity-50">
                    {pendingId === t.id ? "İşleniyor..." : "Reddi Onayla"}
                  </button>
                  <button onClick={() => { setRedModAcikId(null); setRedNedeni(""); }} className="text-[11px] text-gray-400">Vazgeç</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => onayla(t.id)} disabled={pendingId === t.id}
                  className="text-[11px] font-medium bg-success text-white rounded-md px-3 py-1.5 disabled:opacity-50 transition-colors">
                  {pendingId === t.id ? "İşleniyor..." : "Onayla"}
                </button>
                <button onClick={() => setRedModAcikId(t.id)}
                  className="text-[11px] font-medium bg-white border border-danger/30 text-danger hover:bg-danger-bg rounded-md px-3 py-1.5 transition-colors">
                  Reddet
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
