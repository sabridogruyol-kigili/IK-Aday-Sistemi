import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KullaniciDuzenle from "./KullaniciDuzenle";
import YeniKullaniciFormu from "./YeniKullaniciFormu";

export default async function KullanicilarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("kullanicilar")
    .select("rol")
    .eq("email", user.email)
    .single();

  if (profile?.rol !== "YONETIM") {
    redirect("/dashboard");
  }

  const [{ data: kullanicilar }, { data: bolgeler }, { data: atamalar }] =
    await Promise.all([
      supabase
        .from("kullanicilar")
        .select("id, email, ad_soyad, rol, aktif, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("bolgeler").select("id, ad").order("ad"),
      supabase
        .from("kullanici_bolge_atama")
        .select("kullanici_id, bolge_id, bolgeler(ad)"),
    ]);

  const bolgeAdMap: Record<string, string[]> = {};
  const bolgeIdMap: Record<string, string[]> = {};
  (atamalar ?? []).forEach((a: any) => {
    const ad = a.bolgeler?.ad ?? "?";
    bolgeAdMap[a.kullanici_id] = [...(bolgeAdMap[a.kullanici_id] ?? []), ad];
    bolgeIdMap[a.kullanici_id] = [...(bolgeIdMap[a.kullanici_id] ?? []), a.bolge_id];
  });

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Kullanıcı Yönetimi</div>
        <div className="text-xs text-gray-400 mt-0.5">
          BM / İK / Yönetim kullanıcıları ve bölge atamaları
        </div>
      </div>

      {/* Yeni kullanıcı formu */}
      <div className="bg-white border border-gray-200 rounded-card p-4 mb-5">
        <div className="text-sm font-semibold text-navy-3 mb-3">Yeni Kullanıcı</div>
        <YeniKullaniciFormu bolgeler={bolgeler ?? []} />
      </div>

      {/* Liste */}
      <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
              <th className="text-left px-3 py-2">Ad Soyad</th>
              <th className="text-left px-3 py-2">E-posta</th>
              <th className="text-left px-3 py-2">Rol</th>
              <th className="text-left px-3 py-2">Bölge(ler)</th>
              <th className="text-left px-3 py-2">Durum</th>
              <th className="text-left px-3 py-2">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {(kullanicilar ?? []).map((k) => (
              <tr key={k.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-navy-3">{k.ad_soyad}</td>
                <td className="px-3 py-2 text-gray-600">{k.email}</td>
                <td className="px-3 py-2 text-gray-600">{k.rol}</td>
                <td className="px-3 py-2 text-gray-600">
                  {(bolgeAdMap[k.id] ?? []).join(", ") || "—"}
                </td>
                <td className="px-3 py-2">
                  {k.aktif ? (
                    <span className="text-success">Aktif</span>
                  ) : (
                    <span className="text-danger">Pasif</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <KullaniciDuzenle
                    kullaniciId={k.id}
                    mevcutAdSoyad={k.ad_soyad}
                    mevcutEmail={k.email}
                    mevcutRol={k.rol}
                    mevcutAktif={k.aktif}
                    mevcutBolgeIdler={bolgeIdMap[k.id] ?? []}
                    bolgeler={bolgeler ?? []}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
