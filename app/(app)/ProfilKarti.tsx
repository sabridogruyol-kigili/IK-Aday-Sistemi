"use client";

import { useRef, useState } from "react";
import { getBenimProfilim, profilDegisiklikTalebiGonder, profilFotoYukle, type ProfilBilgisi } from "./ProfilActions";

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

function Alan({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase">{label}</div>
      <div className="text-[13px] text-navy-3">{value}</div>
    </div>
  );
}

export default function ProfilKarti({ displayName, rol, initials }: { displayName: string; rol: string; initials: string }) {
  const [acik, setAcik] = useState(false);
  const [profil, setProfil] = useState<ProfilBilgisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [duzenlemeModu, setDuzenlemeModu] = useState(false);

  const [telefon, setTelefon] = useState("");
  const [dogumTarihi, setDogumTarihi] = useState("");
  const [egitimDuzeyi, setEgitimDuzeyi] = useState("");
  const [okul, setOkul] = useState("");
  const [bolum, setBolum] = useState("");
  const [adres, setAdres] = useState("");
  const [email, setEmail] = useState("");
  const [sertifikalar, setSertifikalar] = useState<string[]>([]);
  const [yeniSertifika, setYeniSertifika] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [basariliMesaj, setBasariliMesaj] = useState<string | null>(null);

  function ac() {
    setAcik(true);
    setDuzenlemeModu(false);
    setYukleniyor(true);
    setBasariliMesaj(null);
    getBenimProfilim().then((p) => {
      setProfil(p);
      if (p) {
        setTelefon(p.telefon ?? "");
        setDogumTarihi(p.dogum_tarihi ?? "");
        setEgitimDuzeyi(p.egitim_duzeyi ?? "");
        setOkul(p.okul ?? "");
        setBolum(p.bolum ?? "");
        setAdres(p.adres ?? "");
        setEmail(p.email ?? "");
        setSertifikalar(p.sertifikalar.map((s) => s.sertifika_adi));
        setFotoUrl(p.profil_foto_url);
      }
      setYukleniyor(false);
    });
  }

  function fotoSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setFotoYukleniyor(true);
    setHata(null);
    const fd = new FormData();
    fd.set("dosya", dosya);
    profilFotoYukle(fd).then((res) => {
      setFotoYukleniyor(false);
      if (res.error) { setHata(res.error); return; }
      setFotoUrl(res.url ?? null);
    });
  }

  function sertifikaEkle() {
    if (!yeniSertifika.trim()) return;
    setSertifikalar((s) => [...s, yeniSertifika.trim()]);
    setYeniSertifika("");
  }

  function sertifikaSil(i: number) {
    setSertifikalar((s) => s.filter((_, idx) => idx !== i));
  }

  function talebiGonder() {
    setKaydediliyor(true);
    setHata(null);
    profilDegisiklikTalebiGonder({
      telefon: telefon || null, egitim_duzeyi: egitimDuzeyi || null, okul: okul || null, bolum: bolum || null,
      adres: adres || null, email: email || null, profil_foto_url: fotoUrl, sertifikalar,
    }).then((res) => {
      setKaydediliyor(false);
      if (res.error) { setHata(res.error); return; }
      setDuzenlemeModu(false);
      setBasariliMesaj("Değişiklik talebiniz Bordro onayına gönderildi. Onaylanınca bilgileriniz güncellenecek.");
      ac();
    });
  }

  const yas = profil ? yasHesapla(dogumTarihi || profil.dogum_tarihi) : null;

  return (
    <>
      <button onClick={ac} className="flex items-center gap-2.5 w-full text-left hover:bg-white/5 rounded-md p-1 -m-1 transition-colors">
        <div className="w-[30px] h-[30px] rounded-full bg-accent border border-white/20 flex items-center justify-center text-[11px] font-semibold text-navy-3 shrink-0 overflow-hidden">
          {profil?.profil_foto_url ? <img src={profil.profil_foto_url} alt="" className="w-full h-full object-cover" /> : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-xs font-medium leading-tight truncate">{displayName}</div>
          <div className="text-white/40 text-[10px] tracking-wide">{ROL_ETIKET[rol] ?? rol}</div>
        </div>
      </button>

      {acik && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAcik(false)}>
          <div className="bg-white rounded-card border border-gray-200 w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 shrink-0">
              <div className="text-sm font-semibold text-navy-3">Profilim</div>
              <button onClick={() => setAcik(false)} className="text-gray-400 text-lg leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {yukleniyor ? (
                <div className="text-xs text-gray-400 text-center py-10">Yükleniyor...</div>
              ) : !profil ? (
                <div className="text-xs text-danger text-center py-10">Profil yüklenemedi.</div>
              ) : (
                <div className="space-y-5">
                  {profil.bekleyenTalep && (
                    <div className="bg-accent/10 border border-accent/30 rounded-md px-3 py-2 text-[12px] text-navy-3">
                      ⏳ {new Date(profil.bekleyenTalep.created_at).toLocaleDateString("tr-TR")} tarihli bir değişiklik talebiniz Bordro onayını bekliyor. Onaylanana kadar mevcut bilgileriniz geçerlidir.
                    </div>
                  )}
                  {basariliMesaj && (
                    <div className="bg-success-bg text-success rounded-md px-3 py-2 text-[12px]">{basariliMesaj}</div>
                  )}

                  {/* Üst kimlik şeridi */}
                  <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-lg font-semibold text-navy-3 overflow-hidden">
                        {fotoUrl ? <img src={fotoUrl} alt="" className="w-full h-full object-cover" /> : initials}
                      </div>
                      {duzenlemeModu && (
                        <button onClick={() => fotoInputRef.current?.click()} disabled={fotoYukleniyor}
                          className="absolute -bottom-1 -right-1 bg-navy text-white rounded-full w-6 h-6 flex items-center justify-center text-[11px] border-2 border-white">
                          {fotoYukleniyor ? "…" : "✎"}
                        </button>
                      )}
                      <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={fotoSecildi} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-navy-3 truncate">{profil.ad_soyad}</div>
                      <div className="text-[12px] text-gray-400">{ROL_ETIKET[profil.rol] ?? profil.rol}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{profil.magazalar.join(", ") || "—"}</div>
                    </div>
                  </div>

                  {/* Temel Bilgiler */}
                  <div>
                    <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Temel Bilgiler</div>
                    {duzenlemeModu ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-[9px] text-gray-400 uppercase mb-1">E-posta</label>
                          <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" /></div>
                        <div><label className="block text-[9px] text-gray-400 uppercase mb-1">Telefon</label>
                          <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="05XX XXX XX XX" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" /></div>
                        <div><label className="block text-[9px] text-gray-400 uppercase mb-1">Doğum Tarihi</label>
                          <input type="date" value={dogumTarihi} onChange={(e) => setDogumTarihi(e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" /></div>
                        <div className="col-span-2"><label className="block text-[9px] text-gray-400 uppercase mb-1">Adres</label>
                          <textarea value={adres} onChange={(e) => setAdres(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm resize-none" /></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <Alan label="E-posta" value={profil.email} />
                        <Alan label="Telefon" value={profil.telefon ?? "—"} />
                        <Alan label="Yaş" value={yas != null ? `${yas}` : "—"} />
                        <Alan label="Adres" value={profil.adres ?? "—"} />
                      </div>
                    )}
                  </div>

                  {/* Eğitim */}
                  <div>
                    <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Eğitim</div>
                    {duzenlemeModu ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className="block text-[9px] text-gray-400 uppercase mb-1">Eğitim Düzeyi</label>
                          <input value={egitimDuzeyi} onChange={(e) => setEgitimDuzeyi(e.target.value)} placeholder="Örn. Lisans" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" /></div>
                        <div><label className="block text-[9px] text-gray-400 uppercase mb-1">Okul</label>
                          <input value={okul} onChange={(e) => setOkul(e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" /></div>
                        <div><label className="block text-[9px] text-gray-400 uppercase mb-1">Bölüm</label>
                          <input value={bolum} onChange={(e) => setBolum(e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" /></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <Alan label="Eğitim Düzeyi" value={profil.egitim_duzeyi ?? "—"} />
                        <Alan label="Okul" value={profil.okul ?? "—"} />
                        <Alan label="Bölüm" value={profil.bolum ?? "—"} />
                      </div>
                    )}
                  </div>

                  {/* Sertifikalar */}
                  <div>
                    <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Sertifikalar</div>
                    {duzenlemeModu ? (
                      <div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {sertifikalar.map((s, i) => (
                            <span key={i} className="text-[11px] bg-gray-100 text-navy-3 rounded-full px-2.5 py-1 flex items-center gap-1.5">
                              {s} <button onClick={() => sertifikaSil(i)} className="text-gray-400 hover:text-danger">×</button>
                            </span>
                          ))}
                          {sertifikalar.length === 0 && <span className="text-[11px] text-gray-300 italic">Henüz sertifika eklenmedi.</span>}
                        </div>
                        <div className="flex gap-2">
                          <input value={yeniSertifika} onChange={(e) => setYeniSertifika(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sertifikaEkle(); } }}
                            placeholder="Sertifika adı yazıp Enter'a basın" className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
                          <button onClick={sertifikaEkle} className="text-xs font-medium bg-white border border-info/40 text-info rounded-md px-2.5">Ekle</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {profil.sertifikalar.length === 0 ? (
                          <span className="text-[12px] text-gray-300 italic">Kayıtlı sertifika yok.</span>
                        ) : (
                          profil.sertifikalar.map((s) => (
                            <span key={s.id} className="text-[11px] bg-gray-100 text-navy-3 rounded-full px-2.5 py-1">{s.sertifika_adi}</span>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* İzin Bilgisi */}
                  <div>
                    <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">İzin Bilgisi</div>
                    <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-md p-3">
                      <Alan label="Yıllık İzin Hakkı" value={`${profil.yillik_izin_hakki} gün`} />
                      <Alan label="Kullanılan" value={`${profil.kullanilan_izin_gun} gün`} />
                      <Alan label="Kalan" value={`${profil.yillik_izin_hakki - profil.kullanilan_izin_gun} gün`} />
                    </div>
                  </div>

                  {/* Akademi Kiğılı — henüz aktif değil, boş görünüyor */}
                  <div>
                    <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Akademi Kiğılı</div>
                    <div className="bg-gray-50 rounded-md p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <Alan label="Son Giriş" value={profil.akademi.sonGirisTarihi ?? "—"} />
                        <Alan label="Toplam İzlenen Eğitim" value={`${profil.akademi.toplamIzlenenEgitim}`} />
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-400 uppercase mb-1">Son İzlenen 3 Eğitim</div>
                        {profil.akademi.sonUcEgitim.length === 0 ? (
                          <div className="text-[11px] text-gray-300 italic">Henüz entegrasyon aktif değil.</div>
                        ) : (
                          <ul className="text-[12px] text-navy-3 list-disc pl-4">
                            {profil.akademi.sonUcEgitim.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bordro Bilgileri — placeholder, ileride Bordro tarafından doldurulacak */}
                  <div>
                    <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Son Bordro Bilgileri</div>
                    <div className="bg-gray-50 rounded-md p-3 text-[11px] text-gray-400 italic">
                      Bu bölüm Bordro ve Çalışma İlişkileri tarafından ayrıca doldurulacak — henüz veri girilmedi.
                    </div>
                  </div>

                  {hata && <div className="text-[11px] text-danger bg-danger-bg rounded-md px-3 py-2">{hata}</div>}

                  <div className="flex gap-2 pt-1">
                    {duzenlemeModu ? (
                      <>
                        <button onClick={talebiGonder} disabled={kaydediliyor}
                          className="bg-navy hover:bg-navy-2 text-white rounded-md px-4 py-2 text-xs font-medium disabled:opacity-50 transition-colors">
                          {kaydediliyor ? "Gönderiliyor..." : "Değişiklikleri Onaya Gönder"}
                        </button>
                        <button onClick={() => setDuzenlemeModu(false)} className="text-xs text-gray-400">Vazgeç</button>
                      </>
                    ) : (
                      !profil.bekleyenTalep && (
                        <button onClick={() => setDuzenlemeModu(true)}
                          className="text-[11px] font-medium bg-white border border-info/40 text-info hover:bg-info/5 rounded-md px-3 py-1.5 transition-colors">
                          Bilgilerimi Düzenle
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
