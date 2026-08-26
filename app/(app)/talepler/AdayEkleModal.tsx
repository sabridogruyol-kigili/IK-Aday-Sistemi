"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { yonlendirAday } from "../adaylar/actions";

export default function AdayEkleModal({ talepId, onClose, onDone }: {
  talepId: string; onClose: () => void; onDone: () => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [adSoyad, setAdSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [email, setEmail] = useState("");
  const [cinsiyet, setCinsiyet] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  const [cvYolu, setCvYolu] = useState<string | null>(null);
  const [cvAdi, setCvAdi] = useState<string | null>(null);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function dosyaYukle(file: File) {
    setHata(null);
    if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type)) {
      setHata("Sadece PDF veya Word dosyası yükleyebilirsiniz.");
      return;
    }
    setYukleniyor(true);
    const yol = `${talepId}/${Date.now()}-${file.name}`;
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
    if (!adSoyad.trim() || !cvYolu) return;
    if (!emailGecerliMi(email)) { setHata("Geçerli bir e-posta adresi girin."); return; }
    setHata(null);
    const fd = new FormData();
    fd.set("talep_id", talepId);
    fd.set("ad_soyad", adSoyad);
    fd.set("telefon", telefon);
    fd.set("email", email);
    fd.set("cinsiyet", cinsiyet);
    fd.set("cv_yolu", cvYolu);
    startTransition(async () => {
      const res = await yonlendirAday(fd);
      if (res?.error) {
        setHata(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 bg-navy-3/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-navy-3">Yeni Aday Ekle</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Ad Soyad *</label>
            <input value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" autoFocus />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Telefon Numarası</label>
            <input type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)}
              placeholder="05XX XXX XX XX"
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">E-posta *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="aday@ornek.com"
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
            <div className="text-[10px] text-gray-400 mt-1">
              Süreç onaylandığında ve işe alım tamamlandığında adaya bu adrese bilgilendirme maili gider.
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Cinsiyet</label>
            <select value={cinsiyet} onChange={(e) => setCinsiyet(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
              <option value="">Seçin</option>
              <option value="Kadın">Kadın</option>
              <option value="Erkek">Erkek</option>
              <option value="Belirtilmedi">Belirtilmedi</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">CV *</label>
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
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                surukleniyor ? "border-navy bg-info-bg" : cvYolu ? "border-success bg-success-bg" : "border-gray-300 hover:border-navy hover:bg-gray-50"
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) dosyaYukle(f); }} />
              {yukleniyor ? (
                <div className="text-xs text-gray-400">Yükleniyor...</div>
              ) : cvAdi ? (
                <div className="text-xs text-success font-medium">✓ {cvAdi}</div>
              ) : (
                <>
                  <div className="text-xl mb-1">📄</div>
                  <div className="text-xs text-gray-400">CV'yi sürükleyip bırakın ya da tıklayın (PDF/Word) — zorunlu</div>
                </>
              )}
            </div>
          </div>

          {hata && <div className="text-[11px] text-danger">{hata}</div>}

          <button onClick={ekle} disabled={pending || !adSoyad.trim() || !cvYolu || !emailGecerliMi(email)}
            className="w-full bg-navy text-white rounded-md py-2 text-sm font-medium disabled:opacity-50">
            {pending ? "Ekleniyor..." : "Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}
