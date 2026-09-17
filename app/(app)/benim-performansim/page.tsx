import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPersonelDetay, getPersonelPerformansGecmisi, getKisiPerformansSirketOrtalamasi } from "../talepler/yeni/actions-cikarma";
import BenimPerformansimIcerik from "./BenimPerformansimIcerik";

export default async function BenimPerformansimPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol, personel_id, ad_soyad").eq("email", user.email).single();
  if (!me) redirect("/login");
  if (!me.personel_id) {
    return (
      <div className="max-w-lg">
        <div className="text-sm font-semibold text-navy-3 mb-2">Performansım</div>
        <div className="text-xs text-gray-500 bg-white border border-gray-200 rounded-card p-4">
          Hesabınız henüz bir personel kaydına bağlanmamış — bu sayfa için İK/Yönetim'in Ayarlar &gt; Kullanıcılar'dan hesabınızı ilgili personel kaydınıza bağlaması gerekiyor.
        </div>
      </div>
    );
  }

  const { data: personel } = await supabase
    .from("personel")
    .select("guncel_unvan, guncel_magaza_id, magazalar!guncel_magaza_id(magaza_adi)")
    .eq("id", me.personel_id)
    .maybeSingle();

  const [detay, gecmis, sirketOrtalamasi] = await Promise.all([
    getPersonelDetay(me.personel_id),
    getPersonelPerformansGecmisi(me.personel_id),
    getKisiPerformansSirketOrtalamasi(),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Performansım</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {personel?.guncel_unvan ?? "—"} · {(personel as any)?.magazalar?.magaza_adi ?? "—"}
        </div>
      </div>
      <BenimPerformansimIcerik detay={detay} gecmis={gecmis} adSoyad={me.ad_soyad} sirketOrtalamasi={sirketOrtalamasi} />
    </div>
  );
}
