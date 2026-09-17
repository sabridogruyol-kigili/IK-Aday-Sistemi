import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdayHavuzuIcerik from "./AdayHavuzuIcerik";

export default async function AdaylarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return null;
  if (me.rol === "BORDRO") redirect("/evrak-onay");

  // Aday Havuzu'nun tek amacı: "Aday Havuzuna Al" denilen kişilerin
  // arşivlendiği, ileride başka bir İşe Alım talebine yeniden
  // yönlendirilebileceği bir bekleme alanı. Aktif süreçteki adaylar burada
  // DEĞİL, ilgili oldukları talebin altında (Talepler sayfası) görünür —
  // burası sadece talepten bağımsızlaşmış (talep_id NULL, durum HAVUZDA)
  // kayıtları listeler. Artık "Yeni Aday Ekle" ile hiç talebe bağlı olmadan
  // da doğrudan buraya aday eklenebiliyor.
  const [{ data: havuzdakiler }, { data: aktifIseAlimTalepleri }] = await Promise.all([
    supabase
      .from("adaylar")
      .select("id, ad_soyad, telefon, email, cv_drive_link, tc_kimlik_no, unvan, referans, updated_at, magazalar!havuz_magaza_id(magaza_adi)")
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
      <div className="text-xs text-gray-400 mb-3">
        "Aday Havuzuna Al" ile arşivlenmiş, herhangi bir talebe bağlı olmayan adaylar — buradan yeni bir İşe Alım talebine yeniden yönlendirilebilirler. Aktif süreçteki adaylar için Talepler sayfasına bakın.
      </div>
      <AdayHavuzuIcerik
        havuzdakiler={(havuzdakiler ?? []).map((h: any) => ({
          id: h.id, ad_soyad: h.ad_soyad, telefon: h.telefon, email: h.email,
          cv_drive_link: h.cv_drive_link, tc_kimlik_no: h.tc_kimlik_no, unvan: h.unvan, referans: h.referans,
          havuz_magaza_adi: h.magazalar?.magaza_adi,
        }))}
        aktifIseAlimTalepleri={(aktifIseAlimTalepleri ?? []).map((t: any) => ({
          id: t.id, talep_no: t.talep_no, magaza_adi: t.magazalar?.magaza_adi ?? "—",
        }))}
      />
    </div>
  );
}
