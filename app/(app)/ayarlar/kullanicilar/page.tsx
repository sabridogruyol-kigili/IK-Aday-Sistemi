import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createKullanici, toggleAktif } from "./actions";

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
  (atamalar ?? []).forEach((a: any) => {
    const ad = a.bolgeler?.ad ?? "?";
    bolgeAdMap[a.kullanici_id] = [...(bolgeAdMap[a.kullanici_id] ?? []), ad];
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
        <form action={createKullanici} className="grid grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
              E-posta *
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
              Ad Soyad *
            </label>
            <input
              name="ad_soyad"
              required
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
              Rol *
            </label>
            <select
              name="rol"
              required
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="BM">BM</option>
              <option value="IK">İK</option>
              <option value="YONETIM">Yönetim</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-navy text-white rounded-md py-1.5 text-sm font-medium"
          >
            Ekle
          </button>
          <div className="col-span-4">
            <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">
              Sorumlu Bölge(ler) — BM/İK için, Yönetim tümünü zaten görür
            </label>
            <div className="border border-gray-300 rounded-md max-h-40 overflow-y-auto divide-y divide-gray-100 max-w-xs">
              {(bolgeler ?? []).map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-xs text-gray-600 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" name="bolge_ids" value={b.id} />
                  {b.ad}
                </label>
              ))}
              {(bolgeler ?? []).length === 0 && (
                <div className="text-xs text-gray-400 px-2.5 py-2">Henüz bölge tanımlı değil.</div>
              )}
            </div>
          </div>
        </form>
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
                  <form action={toggleAktif}>
                    <input type="hidden" name="id" value={k.id} />
                    <input type="hidden" name="aktif" value={String(!k.aktif)} />
                    <button className="text-xs text-info underline">
                      {k.aktif ? "Pasife al" : "Aktif et"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
