"use client";

import type { EvrakDetay } from "./actions";

function Alan({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase">{label}</div>
      <div className="text-[12px] text-navy-3">{value || "—"}</div>
    </div>
  );
}

function EvetHayir({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-gray-300">—</span>;
  return <span className={value ? "text-accent font-medium" : "text-gray-500"}>{value ? "Evet" : "Hayır"}</span>;
}

function tarihFormat(t: string | null | undefined): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function adresBirlestir(d: EvrakDetay, ek: "" | "2"): string {
  const il = ek === "" ? d.il : d.il2;
  const ilce = ek === "" ? d.ilce : d.ilce2;
  const mahalle = ek === "" ? d.mahalle : d.mahalle2;
  const cadde = ek === "" ? d.cadde : d.cadde2;
  const sokak = ek === "" ? d.sokak : d.sokak2;
  const siteAdi = ek === "" ? d.site_adi : d.site_adi2;
  const binaNo = ek === "" ? d.bina_no : d.bina_no2;
  const daireNo = ek === "" ? d.daire_no : d.daire_no2;
  const parcalar = [
    mahalle && `${mahalle} Mah.`, cadde, sokak, siteAdi,
    binaNo && `No: ${binaNo}`, daireNo && `Daire: ${daireNo}`,
    ilce, il,
  ].filter(Boolean);
  return parcalar.length > 0 ? parcalar.join(", ") : "";
}

export default function BilgiDetayModal({ detay, onClose }: { detay: EvrakDetay | null; onClose: () => void }) {
  const ikametAdresi = detay ? adresBirlestir(detay, "") : "";
  const ikinciAdres = detay ? adresBirlestir(detay, "2") : "";

  return (
    <div className="fixed inset-0 bg-navy-3/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card border border-gray-200 w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="text-sm font-semibold text-navy-3">Evrak Detayı — {detay?.ad_soyad}</div>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-[11px] font-semibold text-navy-3 uppercase mb-2">Temel Bilgiler</div>
            <div className="grid grid-cols-2 gap-3">
              <Alan label="E-posta" value={detay?.email} />
              <Alan label="Cinsiyet" value={detay?.cinsiyet} />
              <Alan label="Doğum Tarihi" value={tarihFormat(detay?.dogum_tarihi)} />
              <Alan label="Medeni Hal" value={detay?.medeni_hal} />
              <Alan label="IBAN" value={detay?.iban} />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <div className="text-[11px] font-semibold text-navy-3 uppercase mb-2">Durum Bilgileri</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[9px] text-gray-400 uppercase">Emekli mi?</div>
                <div className="text-[12px]"><EvetHayir value={detay?.emekli} /></div>
              </div>
              <div>
                <div className="text-[9px] text-gray-400 uppercase">Engelli mi?</div>
                <div className="text-[12px]"><EvetHayir value={detay?.engelli} /></div>
              </div>
              <Alan label="Sağlık Raporu Tipi" value={detay?.saglik_rapor_tipi} />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <div className="text-[11px] font-semibold text-navy-3 uppercase mb-2">İkamet Adresi</div>
            {ikametAdresi ? (
              <div className="text-[12px] text-navy-3 bg-gray-50 rounded-md px-3 py-2 leading-relaxed">{ikametAdresi}</div>
            ) : (
              <div className="text-[11px] text-gray-300 italic">Henüz girilmemiş</div>
            )}
          </div>

          {detay?.ikinci_adres_var && (
            <div className="pt-3 border-t border-gray-100">
              <div className="text-[11px] font-semibold text-navy-3 uppercase mb-2">Yaşadığı Adres (İkamet Adresinden Farklı)</div>
              {ikinciAdres ? (
                <div className="text-[12px] text-navy-3 bg-accent/10 rounded-md px-3 py-2 leading-relaxed">{ikinciAdres}</div>
              ) : (
                <div className="text-[11px] text-gray-300 italic">Henüz girilmemiş</div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-gray-100">
            <div className="text-[11px] font-semibold text-navy-3 uppercase mb-2">Onay ve Kayıt Bilgisi</div>
            <div className="grid grid-cols-2 gap-3">
              <Alan label="KVKK Onay Tarihi" value={tarihFormat(detay?.kvkk_onay_tarihi)} />
              <Alan label="Son Güncelleme" value={tarihFormat(detay?.bilgi_guncelleme_tarihi)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
