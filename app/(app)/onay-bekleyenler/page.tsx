import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnayKarti from "./OnayKarti";

export default async function OnayBekleyenlerPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("kullanicilar").select("id").eq("email", user.email).single();
  if (!me) return null;

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
