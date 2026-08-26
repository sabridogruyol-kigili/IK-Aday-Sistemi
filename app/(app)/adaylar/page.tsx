import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdayKarti from "./AdayKarti";

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

  // Not: Yeni aday ekleme sadece Talepler sayfasındaki ilgili talebin "Adaylar" bölümünden
  // yapılır (CV yükleme zorunluluğu ve e-posta doğrulaması orada uygulanıyor).
  // Bu sayfa, RLS'in izin verdiği tüm adayları tek yerden görüp karar/süreç takibi için var.
  const { data: adaylar, error } = await supabase
    .from("adaylar")
    .select(`
      id, ad_soyad, telefon, email, cv_drive_link, yonlendiren_rol, yonlendiren_kullanici_id,
      karari_veren_rol, onay_bm, onay_ik, durum, created_at,
      talepler!inner ( talep_no, magazalar!magaza_id(magaza_adi) )
    `)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Adaylar</div>
        <div className="text-xs text-gray-400 mt-0.5">
          Yetkiniz dahilindeki tüm adaylar ve süreç durumları — yeni aday eklemek için Talepler sayfasından ilgili talebin "Adaylar" bölümünü kullanın.
        </div>
      </div>

      {error && <div className="text-xs text-danger mb-3">Hata: {error.message}</div>}

      <div className="space-y-3">
        {(adaylar ?? []).map((a: any) => (
          <AdayKarti
            key={a.id}
            adayId={a.id}
            adSoyad={a.ad_soyad}
            telefon={a.telefon}
            email={a.email}
            cvLink={a.cv_drive_link}
            talepNo={a.talepler.talep_no}
            magaza={a.talepler.magazalar?.magaza_adi}
            yonlendirenRol={a.yonlendiren_rol}
            yonlendirenKullaniciId={a.yonlendiren_kullanici_id}
            kariVerenRol={a.karari_veren_rol}
            onayBm={a.onay_bm}
            onayIk={a.onay_ik}
            durum={a.durum}
            durumEtiket={DURUM_ETIKET[a.durum] ?? a.durum}
            benimKullaniciId={me.id}
            benimRolum={me.rol}
          />
        ))}
        {(adaylar ?? []).length === 0 && (
          <div className="bg-white border border-gray-200 rounded-card p-6 text-center text-gray-400 text-xs">
            Henüz görüntüleyebileceğiniz bir aday yok.
          </div>
        )}
      </div>
    </div>
  );
}
