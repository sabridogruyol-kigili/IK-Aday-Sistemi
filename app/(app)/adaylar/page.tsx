import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdayKarti from "./AdayKarti";
import YonlendirForm from "./YonlendirForm";

const DURUM_ETIKET: Record<string, string> = {
  YONLENDIRILDI: "Yönlendirildi",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
  ON_GORUSME_PLANLANDI: "Ön Görüşme Planlandı",
  GORUSULDU_OLUMLU: "Görüşüldü — Olumlu",
  GORUSULDU_OLUMSUZ: "Görüşüldü — Olumsuz",
  ISE_ALINDI: "İşe Alındı",
};

export default async function AdaylarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return null;

  const { data: kabulEdilmisTalepler } = await supabase
    .from("talepler")
    .select("id, talep_no, pozisyon_tipi, kisi_sayisi, magazalar!magaza_id(magaza_adi)")
    .eq("talep_turu", "ISE_ALIM")
    .eq("durum", "KABUL_EDILDI")
    .order("created_at", { ascending: false });

  const { data: adaylar } = await supabase
    .from("adaylar")
    .select(`
      id, ad_soyad, cv_drive_link, yonlendiren_rol, karari_veren_rol, durum, created_at,
      talepler!inner ( talep_no, magazalar!magaza_id(magaza_adi) )
    `)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Adaylar</div>
        <div className="text-xs text-gray-400 mt-0.5">Kabul edilmiş İşe Alım talepleri için aday yönlendirme ve süreç takibi</div>
      </div>

      {(kabulEdilmisTalepler ?? []).length > 0 && ["BM", "IK", "YONETIM"].includes(me.rol) && (
        <div className="bg-white border border-gray-200 rounded-card p-4 mb-5">
          <div className="text-sm font-semibold text-navy-3 mb-3">Aday Yönlendir</div>
          <YonlendirForm talepler={kabulEdilmisTalepler ?? []} />
        </div>
      )}

      <div className="space-y-3">
        {(adaylar ?? []).map((a: any) => (
          <AdayKarti
            key={a.id}
            adayId={a.id}
            adSoyad={a.ad_soyad}
            cvLink={a.cv_drive_link}
            talepNo={a.talepler.talep_no}
            magaza={a.talepler.magazalar?.magaza_adi}
            yonlendirenRol={a.yonlendiren_rol}
            kariVerenRol={a.karari_veren_rol}
            durum={a.durum}
            durumEtiket={DURUM_ETIKET[a.durum] ?? a.durum}
            benimRolum={me.rol}
          />
        ))}
        {(adaylar ?? []).length === 0 && (
          <div className="bg-white border border-gray-200 rounded-card p-6 text-center text-gray-400 text-xs">
            Henüz aday yok.
          </div>
        )}
      </div>
    </div>
  );
}
