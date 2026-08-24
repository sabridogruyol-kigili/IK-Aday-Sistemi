import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TalepRow from "./TalepRow";

export default async function TaleplerimPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return null;

  const { data: talepler, error: talepHata } = await supabase
    .from("talepler")
    .select("id, talep_no, talep_turu, pozisyon_tipi, kisi_sayisi, durum, aktif_gonderim_no, created_at, magazalar!magaza_id(magaza_adi)")
    .eq("acan_kullanici_id", me.id)
    .order("created_at", { ascending: false });

  if (talepHata) {
    return <div className="text-xs text-danger">Hata: {talepHata.message}</div>;
  }

  const duraklamislar = (talepler ?? []).filter((t: any) => t.durum === "DURAKLADI");
  const redGerekceleri: Record<string, string> = {};
  for (const t of duraklamislar) {
    const { data: gonderim } = await supabase
      .from("talep_gonderimler")
      .select("id")
      .eq("talep_id", t.id)
      .eq("gonderim_no", t.aktif_gonderim_no)
      .single();
    if (gonderim) {
      const { data: redOnay } = await supabase
        .from("talep_onaylari")
        .select("aciklama, onaylayici_rol_baglami")
        .eq("gonderim_id", gonderim.id)
        .eq("karar", "RED")
        .limit(1)
        .single();
      if (redOnay) {
        redGerekceleri[t.id] = `${redOnay.onaylayici_rol_baglami}: ${redOnay.aciklama}`;
      }
    }
  }

  const adaySayilari: Record<string, number> = {};
  for (const t of talepler ?? []) {
    if (t.talep_turu === "ISE_ALIM" && t.durum === "KABUL_EDILDI") {
      const { count } = await supabase
        .from("adaylar")
        .select("*", { count: "exact", head: true })
        .eq("talep_id", t.id);
      adaySayilari[t.id] = count ?? 0;
    }
  }

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Taleplerim</div>
        <div className="text-xs text-gray-400 mt-0.5">Açtığınız talepler ve durumları</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[10px] text-gray-400 uppercase">
              <th className="text-left px-3 py-2">Talep No</th>
              <th className="text-left px-3 py-2">Tür</th>
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
              <TalepRow
                key={t.id}
                talep={t}
                redGerekce={redGerekceleri[t.id]}
                benimKullaniciId={me.id}
                benimRolum={me.rol}
                baslangicAdaySayisi={adaySayilari[t.id] ?? 0}
              />
            ))}
            {(talepler ?? []).length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400 text-xs">Henüz talep açmadınız.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
