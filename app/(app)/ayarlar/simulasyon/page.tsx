import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SimulasyonFormu from "./SimulasyonFormu";

export default async function SimulasyonPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (me?.rol !== "YONETIM") redirect("/dashboard");

  const { data: magazalar } = await supabase.from("magazalar").select("id, magaza_adi").eq("aktif", true).order("magaza_adi");

  return (
    <div>
      <div className="text-sm font-semibold text-navy-3 mb-1">İşe Alım Simülasyonu</div>
      <div className="text-[11px] text-gray-500 mb-4 leading-relaxed max-w-lg">
        Şube, ünvan, aday adı ve e-posta girip "İşe Al" dediğinizde; onaylanmış bir talep ve "Görüşüldü - Olumlu"
        durumunda bir aday sıfırdan oluşturulur, ardından gerçek "İşe Al" adımı (test amaçlı, gerçek olmayan bir TC ile)
        çalıştırılır — personel kaydı açılır, evrak portalı bağlantısı üretilir ve gerçek "İşe Alımınız Onaylandı"
        maili gönderilir. Sonraki süreç (evrak yükleme, onay) tamamen normal akışla aynıdır.
      </div>
      <SimulasyonFormu magazalar={magazalar ?? []} />
    </div>
  );
}
