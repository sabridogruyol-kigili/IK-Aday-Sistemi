"use client";

import { useState } from "react";
import { getBenimProfilim, profilimiGuncelle, type ProfilBilgisi } from "./ProfilActions";

const ROL_ETIKET: Record<string, string> = {
  BM: "Bölge/Mağaza Müdürü", IK: "İnsan Kaynakları", YONETIM: "Yönetim",
  MAGAZALAR_DIREKTORLUGU: "Mağazalar Direktörlüğü", BORDRO: "Bordro ve Çalışma İlişkileri",
};

function yasHesapla(dogumTarihi: string | null): number | null {
  if (!dogumTarihi) return null;
  const dogum = new Date(dogumTarihi);
  const bugun = new Date();
  let yas = bugun.getFullYear() - dogum.getFullYear();
  const ayFarki = bugun.getMonth() - dogum.getMonth();
  if (ayFarki < 0 || (ayFarki === 0 && bugun.getDate() < dogum.getDate())) yas--;
  return yas;
}

export default function ProfilKarti({ displayName, rol, initials }: { displayName: string; rol: string; initials: string }) {
  const [acik, setAcik] = useState(false);
  const [profil, setProfil] = useState<ProfilBilgisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [duzenlemeModu, setDuzenlemeModu] = useState(false);
  const [dogumTarihi, setDogumTarihi] = useState("");
  const [egitimDuzeyi, setEgitimDuzeyi] = useState("");
  const [telefon, setTelefon] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  function ac() {
    setAcik(true);
    setYukleniyor(true);
    getBenimProfilim().then((p) => {
      setProfil(p);
      setDogumTarihi(p?.dogum_tarihi ?? "");
      setEgitimDuzeyi(p?.egitim_duzeyi ?? "");
      setTelefon(p?.telefon ?? "");
      setYukleniyor(false);
    });
  }

  function kaydet() {
    setKaydediliyor(true);
    setHata(null);
    profilimiGuncelle({ dogum_tarihi: dogumTarihi || null, egitim_duzeyi: egitimDuzeyi || null, telefon: telefon || null }).then((res) => {
      setKaydediliyor(false);
      if (res.error) { setHata(res.error); return; }
      setProfil((p) => (p ? { ...p, dogum_tarihi: dogumTarihi || null, egitim_duzeyi: egitimDuzeyi || null, telefon: telefon || null } : p));
      setDuzenlemeModu(false);
    });
  }

  return (
    <>
      <button onClick={ac} className="flex items-center gap-2.5 w-full text-left hover:bg-white/5 rounded-md p-1 -m-1 transition-colors">
        <div className="w-[30px] h-[30px] rounded-full bg-accent border border-white/20 flex items-center justify-center text-[11px] font-semibold text-navy-3 shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-xs font-medium leading-tight truncate">{displayName}</div>
          <div className="text-white/40 text-[10px] tracking-wide">{ROL_ETIKET[rol] ?? rol}</div>
        </div>
      </button>

      {acik && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAcik(false)}>
          <div className="bg-white rounded-card border border-gray-200 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="text-sm font-semibold text-navy-3">Profilim</div>
              <button onClick={() => setAcik(false)} className="text-gray-400 text-lg leading-none">×</button>
            </div>

            <div className="px-4 py-4">
              {yukleniyor ? (
                <div className="text-xs text-gray-400 text-center py-6">Yükleniyor...</div>
              ) : !profil ? (
                <div className="text-xs text-danger text-center py-6">Profil yüklenemedi.</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-base font-semibold text-navy-3 shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-navy-3 truncate">{profil.ad_soyad}</div>
                      <div className="text-[11px] text-gray-400">{ROL_ETIKET[profil.rol] ?? profil.rol}</div>
                    </div>
                  </div>

                  <ProfilAlani label="E-posta" value={profil.email} />
                  <ProfilAlani label="Çalıştığı Mağazalar" value={profil.magazalar.length > 0 ? profil.magazalar.join(", ") : "—"} />

                  {duzenlemeModu ? (
                    <>
                      <div>
                        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Doğum Tarihi</label>
                        <input type="date" value={dogumTarihi} onChange={(e) => setDogumTarihi(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Eğitim Düzeyi</label>
                        <input value={egitimDuzeyi} onChange={(e) => setEgitimDuzeyi(e.target.value)} placeholder="Örn. Lisans"
                          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Telefon</label>
                        <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="05XX XXX XX XX"
                          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm" />
                      </div>
                      {hata && <div className="text-[11px] text-danger">{hata}</div>}
                      <div className="flex gap-2">
                        <button onClick={kaydet} disabled={kaydediliyor}
                          className="bg-navy hover:bg-navy-2 text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-colors">
                          {kaydediliyor ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                        <button onClick={() => setDuzenlemeModu(false)} className="text-xs text-gray-400">Vazgeç</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <ProfilAlani label="Yaş" value={yasHesapla(profil.dogum_tarihi) != null ? `${yasHesapla(profil.dogum_tarihi)}` : "—"} />
                      <ProfilAlani label="Eğitim Düzeyi" value={profil.egitim_duzeyi ?? "—"} />
                      <ProfilAlani label="Telefon" value={profil.telefon ?? "—"} />
                      <button onClick={() => setDuzenlemeModu(true)}
                        className="text-[11px] font-medium bg-white border border-info/40 text-info hover:bg-info/5 rounded-md px-2.5 py-1 transition-colors">
                        Düzenle
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProfilAlani({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase">{label}</div>
      <div className="text-[13px] text-navy-3">{value}</div>
    </div>
  );
}
