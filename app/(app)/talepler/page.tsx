import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TaleplerimPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("kullanicilar").select("id").eq("email", user.email).single();
  if (!me) return null;

  const { data: talepler } = await supabase
    .from("talepler")
    .select("id, talep_no, pozisyon_tipi, kisi_sayisi, durum, aktif_gonderim_no, created_at, magazalar(magaza_adi)")
    .eq("acan_kullanici_id", me.id)
    .order("created_at", { ascending: false });

  const durumRenk: Record<string, string> = {
    BEKLEMEDE: "text-accent",
    KABUL_EDILDI: "text-success",
    DURAKLADI: "text-danger",
    KAPANDI_RED: "text-danger",
    ISLEME_DEVAM: "text-info",
  };

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Taleplerim</div>
        <div className="text-xs text-gray-400 mt-0.5">Açtığınız talepler ve durumları</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
              <th className="text-left px-3 py-2">Talep No</th>
              <th className="text-left px-3 py-2">Mağaza</th>
              <th className="text-left px-3 py-2">Pozisyon</th>
              <th className="text-left px-3 py-2">Kişi</th>
              <th className="text-left px-3 py-2">Gönderim</th>
              <th className="text-left px-3 py-2">Durum</th>
              <th className="text-left px-3 py-2">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {(talepler ?? []).map((t: any) => (
              <tr key={t.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono text-navy-3">{t.talep_no}</td>
                <td className="px-3 py-2 text-gray-600">{t.magazalar?.magaza_adi}</td>
                <td className="px-3 py-2 text-gray-600">{t.pozisyon_tipi}</td>
                <td className="px-3 py-2 text-gray-600">{t.kisi_sayisi}</td>
                <td className="px-3 py-2 text-gray-600">{t.aktif_gonderim_no}/3</td>
                <td className={`px-3 py-2 font-medium ${durumRenk[t.durum] ?? ""}`}>{t.durum}</td>
                <td className="px-3 py-2 text-gray-400 font-mono text-xs">
                  {new Date(t.created_at).toLocaleDateString("tr-TR")}
                </td>
              </tr>
            ))}
            {(talepler ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-xs">Henüz talep açmadınız.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
