import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnayKarti from "./OnayKarti";
import BordroBekleyenListesi from "./BordroBekleyenListesi";
import ProfilTalepleriListesi from "./ProfilTalepleriListesi";
import { getBekleyenProfilTalepleri } from "../ProfilActions";
import { BELGE_LISTESI, belgeGorunurMu } from "@/lib/evrakSabitleri";

export default async function OnayBekleyenlerPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return null;

  // Bordro ve Çalışma İlişkileri rolünün hiç talep onay yetkisi yok — bu
  // sayfada onlar için "sistem girişi bekleyen" (evrakları İK tarafından
  // onaylanmış ama henüz bordro sistemine girilmemiş) kişiler listelenir,
  // talep onayları hiç gösterilmez.
  if (me.rol === "BORDRO") {
    const { data: tokenlar } = await supabase.from("evrak_erisim_tokenlari").select("personel_id");
    const personelIdleri = Array.from(new Set((tokenlar ?? []).map((t) => t.personel_id)));

    let bekleyenler: { id: string; ad_soyad: string; guncel_unvan: string | null; magaza_adi: string | null }[] = [];
    if (personelIdleri.length > 0) {
      const [{ data: personelListesi }, { data: bilgilerListesi }, { data: belgelerListesi }] = await Promise.all([
        supabase.from("personel").select("id, ad_soyad, guncel_unvan, bordro_giris_tarihi, evrak_iptal_nedeni, magazalar!guncel_magaza_id(magaza_adi)").in("id", personelIdleri),
        supabase.from("personel_evrak_bilgileri").select("personel_id, cinsiyet").in("personel_id", personelIdleri),
        supabase.from("personel_evrak_belgeleri").select("personel_id, belge_tipi, durum").in("personel_id", personelIdleri),
      ]);

      bekleyenler = (personelListesi ?? [])
        .filter((p: any) => !p.bordro_giris_tarihi && !p.evrak_iptal_nedeni)
        .filter((p: any) => {
          const cinsiyet = (bilgilerListesi ?? []).find((b: any) => b.personel_id === p.id)?.cinsiyet ?? null;
          const kendiBelgeleri = (belgelerListesi ?? []).filter((b: any) => b.personel_id === p.id);
          const gerekliBelgeler = BELGE_LISTESI.filter((b) => !b.istegeBagli && belgeGorunurMu(b, cinsiyet));
          const onaylanan = gerekliBelgeler.filter((b) => kendiBelgeleri.find((k: any) => k.belge_tipi === b.id)?.durum === "ONAYLANDI").length;
          return gerekliBelgeler.length > 0 && onaylanan === gerekliBelgeler.length;
        })
        .map((p: any) => ({ id: p.id, ad_soyad: p.ad_soyad, guncel_unvan: p.guncel_unvan, magaza_adi: p.magazalar?.magaza_adi ?? null }));
    }

    const profilTalepleri = await getBekleyenProfilTalepleri();

    return (
      <div>
        <div className="mb-4">
          <div className="text-lg font-semibold text-navy-3">Onay Bekleyenler</div>
          <div className="text-xs text-gray-400 mt-0.5">Evrakları onaylanmış, sisteme giriş bekleyen kişiler ve profil değişiklik talepleri</div>
        </div>

        {profilTalepleri.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Profil Değişiklik Talepleri</div>
            <ProfilTalepleriListesi talepler={profilTalepleri} />
          </div>
        )}

        <div className="text-[11px] font-semibold text-navy-3 uppercase tracking-wide mb-2">Sisteme Giriş Bekleyenler</div>
        <BordroBekleyenListesi kisiler={bekleyenler} benimRolum={me.rol} />
      </div>
    );
  }

  const { data: onaylar } = await supabase
    .from("talep_onaylari")
    .select(`
      id, onaylayici_rol_baglami,
      talep_gonderimler!inner (
        id, aciklama, norm_kontrol_sonucu,
        talepler!inner (
          talep_no, talep_turu, pozisyon_tipi, kisi_sayisi, acan_rol, magaza_id,
          norm_kategorisi, norm_eski_deger, norm_yeni_deger,
          magazalar!magaza_id(magaza_adi),
          hedef_magaza:magazalar!hedef_magaza_id(magaza_adi),
          cikarilacak_personel:personel!cikarilacak_personel_id(id, ad_soyad, guncel_unvan)
        )
      )
    `)
    .eq("onaylayici_kullanici_id", me.id)
    .is("karar", null);

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Onay Bekleyenler</div>
        <div className="text-xs text-gray-400 mt-0.5">Sizin onayınızı bekleyen talepler</div>
      </div>
      <div className="space-y-3">
        {(onaylar ?? []).map((o: any) => {
          const t = o.talep_gonderimler.talepler;
          return (
            <OnayKarti
              key={o.id}
              onayId={o.id}
              talepNo={t.talep_no}
              talepTuru={t.talep_turu}
              magaza={t.magazalar?.magaza_adi}
              magazaId={t.magaza_id}
              pozisyon={t.pozisyon_tipi}
              kisiSayisi={t.kisi_sayisi}
              acanRol={t.acan_rol}
              aciklama={o.talep_gonderimler.aciklama}
              normSonuc={o.talep_gonderimler.norm_kontrol_sonucu}
              cikarilacakPersonelId={t.cikarilacak_personel?.id}
              cikarilacakPersonelAdi={t.cikarilacak_personel?.ad_soyad}
              cikarilacakPersonelUnvan={t.cikarilacak_personel?.guncel_unvan}
              hedefMagaza={t.hedef_magaza?.magaza_adi}
              normKategori={t.norm_kategorisi}
              normEski={t.norm_eski_deger}
              normYeni={t.norm_yeni_deger}
            />
          );
        })}
        {(onaylar ?? []).length === 0 && (
          <div className="bg-white border border-gray-200 rounded-card p-6 text-center text-gray-400 text-xs">
            Onayınızı bekleyen talep yok.
          </div>
        )}
      </div>
    </div>
  );
}
