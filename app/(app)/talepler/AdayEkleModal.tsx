"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { yonlendirAday, adayiHavuzdanYonlendir, getHavuzdakiAdaylar } from "../adaylar/actions";

type HavuzAday = { id: string; ad_soyad: string; telefon: string | null; email: string | null; havuz_magaza_adi: string | null };

export default function AdayEkleModal({ talepId, onClose, onDone }: {
  talepId: string; onClose: () => void; onDone: () => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [mod, setMod] = useState<"yeni" | "havuz">("yeni");

  // --- Yeni Aday alanları ---
  const [adSoyad, setAdSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [email, setEmail] = useState("");
  const [cinsiyet, setCinsiyet] = useState("");
  const [dogumTarihi, setDogumTarihi] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  const [cvYolu, setCvYolu] = useState<string | null>(null);
  const [cvAdi, setCvAdi] = useState<string | null>(null);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);

  // --- Havuzdan Ekle alanları ---
  const [havuzListesi, setHavuzListesi] = useState<HavuzAday[] | null>(null);
  const [secilenHavuzAdayId, setSecilenHavuzAdayId] = useState("");
  const [havuzArama, setHavuzArama] = useState("");

  useEffect(() => {
    if (mod === "havuz" && havuzListesi === null) {
      getHavuzdakiAdaylar().then(setHavuzListesi);
    }
  }, [mod, havuzListesi]);

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
    fd.set("dogum_tarihi", dogumTarihi);
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

  function havuzdanEkle() {
    if (!secilenHavuzAdayId) return;
    setHata(null);
    const fd = new FormData();
    fd.set("aday_id", secilenHavuzAdayId);
    fd.set("yeni_talep_id", talepId);
    startTransition(async () => {
      const res = await adayiHavuzdanYonlendir(fd);
      if (res?.error) {
        setHata(res.error);
        return;
      }
      onDone();
    });
  }

  const havuzFiltrelenmis = (havuzListesi ?? []).filter((h) =>
    !havuzArama || h.ad_soyad.toLocaleLowerCase("tr-TR").includes(havuzArama.toLocaleLowerCase("tr-TR"))
  );

  return (
    <div className="fixed inset-0 bg-navy-3/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-navy-3">Aday Ekle</div>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">×</button>
        </div>

        <div className="flex rounded-md border border-gray-200 overflow-hidden mb-4">
          <button onClick={() => { setMod("yeni"); setHata(null); }}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${mod === "yeni" ? "bg-navy text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
            Yeni Aday
          </button>
          <button onClick={() => { setMod("havuz"); setHata(null); }}
            className={`flex-1 py-1.5 text-xs font-medium border-l border-gray-200 transition-colors ${mod === "havuz" ? "bg-navy text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
            Havuzdan Aday Ekle
          </button>
        </div>

        {mod === "yeni" && (
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
              <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Doğum Tarihi</label>
              <input type="date" value={dogumTarihi} onChange={(e) => setDogumTarihi(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
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
        )}

        {mod === "havuz" && (
          <div className="space-y-3">
            {havuzListesi === null ? (
              <div className="text-xs text-gray-400 text-center py-4">Yükleniyor...</div>
            ) : havuzListesi.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">Havuzda hiç aday yok.</div>
            ) : (
              <>
                <input value={havuzArama} onChange={(e) => setHavuzArama(e.target.value)} placeholder="İsimle ara..."
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {havuzFiltrelenmis.map((h) => (
                    <label key={h.id}
                      className={`flex items-start gap-2 border rounded-md px-2.5 py-2 cursor-pointer transition-colors ${
                        secilenHavuzAdayId === h.id ? "border-navy bg-navy/5" : "border-gray-200 hover:bg-gray-50"
                      }`}>
                      <input type="radio" name="havuz_aday" className="mt-1" checked={secilenHavuzAdayId === h.id}
                        onChange={() => setSecilenHavuzAdayId(h.id)} />
                      <div>
                        <div className="text-sm text-navy-3 font-medium">{h.ad_soyad}</div>
                        <div className="text-[10px] text-gray-400">
                          {h.email ?? "—"} {h.havuz_magaza_adi && <>· Son: {h.havuz_magaza_adi}</>}
                        </div>
                      </div>
                    </label>
                  ))}
                  {havuzFiltrelenmis.length === 0 && (
                    <div className="text-[11px] text-gray-400 text-center py-2">Bu aramayla eşleşen aday yok.</div>
                  )}
                </div>
              </>
            )}

            {hata && <div className="text-[11px] text-danger">{hata}</div>}

            <button onClick={havuzdanEkle} disabled={pending || !secilenHavuzAdayId}
              className="w-full bg-navy text-white rounded-md py-2 text-sm font-medium disabled:opacity-50">
              {pending ? "Ekleniyor..." : "Bu Talebe Yönlendir"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
