import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdayKarti from "./AdayKarti";
import HavuzKarti from "./HavuzKarti";

const DURUM_ETIKET: Record<string, string> = {
  YONLENDIRILDI: "Yönlendirildi",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
  ON_GORUSME_PLANLANDI: "Ön Görüşme Planlandı",
  GORUSULDU_OLUMLU: "Görüşüldü — Olumlu",
  GORUSULDU_OLUMSUZ: "Görüşüldü — Olumsuz",
  ISE_ALINDI: "İşe Alındı",
  BEKLEMEDE: "Beklemede",
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
  // "HAVUZDA" durumundakiler burada değil, aşağıdaki ayrı Aday Havuzu bölümünde listelenir
  // (talep_id NULL olduğu için talepler!inner ile eşleşmezler, ayrı sorgu gerekir).
  const [{ data: adaylar, error }, { data: havuzdakiler }, { data: aktifIseAlimTalepleri }] = await Promise.all([
    supabase
      .from("adaylar")
      .select(`
        id, ad_soyad, telefon, email, cv_drive_link, yonlendiren_rol, yonlendiren_kullanici_id,
        karari_veren_rol, onay_bm, onay_ik, mulakat_bm, mulakat_ik, durum, created_at, tc_kimlik_no,
        talepler!inner ( talep_no, magazalar!magaza_id(magaza_adi) )
      `)
      .neq("durum", "HAVUZDA")
      .order("created_at", { ascending: false }),
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
          Yetkiniz dahilindeki tüm adaylar ve süreç durumları — yeni aday eklemek için Talepler sayfasından ilgili talebin "Adaylar" bölümünü kullanın.
        </div>
      </div>

      {(havuzdakiler ?? []).length > 0 && (
        <div className="mb-5">
          <div className="text-sm font-semibold text-navy-3 mb-2">
            Havuzdaki Adaylar <span className="text-xs text-gray-400 font-normal">({havuzdakiler!.length})</span>
          </div>
          <div className="space-y-2">
            {havuzdakiler!.map((h: any) => (
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
          </div>
        </div>
      )}

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
            tcKimlikNo={a.tc_kimlik_no}
            yonlendirenRol={a.yonlendiren_rol}
            yonlendirenKullaniciId={a.yonlendiren_kullanici_id}
            kariVerenRol={a.karari_veren_rol}
            onayBm={a.onay_bm}
            onayIk={a.onay_ik}
            mulakatBm={a.mulakat_bm}
            mulakatIk={a.mulakat_ik}
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
