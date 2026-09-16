"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { havuzaDogrudanAdayEkle } from "./actions";

export default function HavuzaAdayEkleModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [adSoyad, setAdSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [email, setEmail] = useState("");
  const [unvan, setUnvan] = useState("");
  const [notlar, setNotlar] = useState("");
  const [referans, setReferans] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  const [cvYolu, setCvYolu] = useState<string | null>(null);
  const [cvAdi, setCvAdi] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function dosyaYukle(file: File) {
    setHata(null);
    if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type)) {
      setHata("Sadece PDF veya Word dosyası yükleyebilirsiniz.");
      return;
    }
    setYukleniyor(true);
    const yol = `havuz/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("cv-dosyalar").upload(yol, file);
    setYukleniyor(false);
    if (error) {
      setHata("Yükleme başarısız: " + error.message);
      return;
    }
    setCvYolu(yol);
    setCvAdi(file.name);
  }

  function emailGecerliMi(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  function ekle() {
    if (!adSoyad.trim() || !unvan.trim() || !cvYolu) return;
    if (!emailGecerliMi(email)) { setHata("Geçerli bir e-posta adresi girin."); return; }
    setHata(null);
    const fd = new FormData();
    fd.set("ad_soyad", adSoyad);
    fd.set("telefon", telefon);
    fd.set("email", email);
    fd.set("unvan", unvan);
    fd.set("notlar", notlar);
    fd.set("referans", referans);
    fd.set("cv_yolu", cvYolu);
    startTransition(async () => {
      const res = await havuzaDogrudanAdayEkle(fd);
      if (res?.error) { setHata(res.error); return; }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="text-sm font-semibold text-navy-3">Havuza Yeni Aday Ekle</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Ad Soyad *</label>
            <input value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Ünvan *</label>
            <input value={unvan} onChange={(e) => setUnvan(e.target.value)} placeholder="Örn. Satış Danışmanı" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Telefon</label>
              <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="05XX XXX XX XX" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">E-posta *</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Referans Bilgisi</label>
            <input value={referans} onChange={(e) => setReferans(e.target.value)} placeholder="Örn. Ahmet Bey'in tanıdığı" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Not</label>
            <textarea value={notlar} onChange={(e) => setNotlar(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm resize-none" />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">CV *</label>
            <button onClick={() => fileInputRef.current?.click()} disabled={yukleniyor}
              className="w-full border border-dashed border-gray-300 rounded-md px-3 py-2.5 text-xs text-gray-500 hover:border-navy transition-colors">
              {yukleniyor ? "Yükleniyor..." : cvAdi ? `📄 ${cvAdi}` : "PDF veya Word dosyası seçin"}
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
              onChange={(e) => e.target.files?.[0] && dosyaYukle(e.target.files[0])} />
          </div>

          {hata && <div className="text-[11px] text-danger bg-danger-bg rounded-md px-2.5 py-2">{hata}</div>}

          <button onClick={ekle} disabled={pending || !adSoyad.trim() || !unvan.trim() || !cvYolu}
            className="w-full bg-navy hover:bg-navy-2 text-white rounded-md py-2 text-sm font-medium disabled:opacity-40 transition-colors">
            {pending ? "Ekleniyor..." : "Havuza Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}
