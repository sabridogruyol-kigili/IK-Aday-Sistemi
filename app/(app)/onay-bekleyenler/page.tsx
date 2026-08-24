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
        talepler!inner ( talep_no, pozisyon_tipi, kisi_sayisi, acan_rol, magazalar(magaza_adi) )
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
        {(onaylar ?? []).map((o: any) => (
          <OnayKarti
            key={o.id}
            onayId={o.id}
            talepNo={o.talep_gonderimler.talepler.talep_no}
            magaza={o.talep_gonderimler.talepler.magazalar?.magaza_adi}
            pozisyon={o.talep_gonderimler.talepler.pozisyon_tipi}
            kisiSayisi={o.talep_gonderimler.talepler.kisi_sayisi}
            acanRol={o.talep_gonderimler.talepler.acan_rol}
            aciklama={o.talep_gonderimler.aciklama}
            normSonuc={o.talep_gonderimler.norm_kontrol_sonucu}
          />
        ))}
        {(onaylar ?? []).length === 0 && (
          <div className="bg-white border border-gray-200 rounded-card p-6 text-center text-gray-400 text-xs">
            Onayınızı bekleyen talep yok.
          </div>
        )}
      </div>
    </div>
  );
}
