import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HavuzKarti from "./HavuzKarti";

export default async function AdaylarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return null;

  // Aday Havuzu'nun tek amacı: "Aday Havuzuna Al" denilen kişilerin
  // arşivlendiği, ileride başka bir İşe Alım talebine yeniden
  // yönlendirilebileceği bir bekleme alanı. Aktif süreçteki adaylar burada
  // DEĞİL, ilgili oldukları talebin altında (Talepler sayfası) görünür —
  // burası sadece talepten bağımsızlaşmış (talep_id NULL, durum HAVUZDA)
  // kayıtları listeler.
  const [{ data: havuzdakiler }, { data: aktifIseAlimTalepleri }] = await Promise.all([
    supabase
      .from("adaylar")
      .select("id, ad_soyad, telefon, email, cv_drive_link, tc_kimlik_no, updated_at, magazalar!havuz_magaza_id(magaza_adi)")
      .eq("durum", "HAVUZDA")
      .order("updated_at", { ascending: false }),
    supabase
      .from("talepler")
      .select("id, talep_no, magazalar!magaza_id(magaza_adi)")
      .eq("talep_turu", "ISE_ALIM")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Aday Havuzu</div>
        <div className="text-xs text-gray-400 mt-0.5">
          "Aday Havuzuna Al" ile arşivlenmiş, herhangi bir talebe bağlı olmayan adaylar — buradan yeni bir İşe Alım talebine yeniden yönlendirilebilirler. Aktif süreçteki adaylar için Talepler sayfasına bakın.
        </div>
      </div>

      <div className="space-y-2">
        {(havuzdakiler ?? []).map((h: any) => (
          <HavuzKarti
            key={h.id}
            adayId={h.id}
            adSoyad={h.ad_soyad}
            telefon={h.telefon}
            email={h.email}
            cvLink={h.cv_drive_link}
            tcKimlikNo={h.tc_kimlik_no}
            havuzMagaza={h.magazalar?.magaza_adi}
            aktifIseAlimTalepleri={(aktifIseAlimTalepleri ?? []).map((t: any) => ({
              id: t.id, talep_no: t.talep_no, magaza_adi: t.magazalar?.magaza_adi ?? "—",
            }))}
          />
        ))}
        {(havuzdakiler ?? []).length === 0 && (
          <div className="bg-white border border-gray-200 rounded-card p-6 text-center text-gray-400 text-xs">
            Havuzda hiç aday yok. Bir adayı havuza almak için, ilgili talebin süreç detayında "Beklesin" kararı verip ardından "Aday Havuzuna Al"a basın.
          </div>
        )}
      </div>
    </div>
  );
}
