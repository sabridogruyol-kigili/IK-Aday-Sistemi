import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RevizyonForm from "./RevizyonForm";

const TALEP_TURU_ETIKET: Record<string, string> = {
  ISE_ALIM: "İşe Alım",
  ISTEN_CIKARMA: "İşten Çıkarma",
  ROTASYON: "Rotasyon",
};

export default async function TaleplerimPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("kullanicilar").select("id").eq("email", user.email).single();
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
              <tr key={t.id} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2 font-mono text-navy-3">{t.talep_no}</td>
                <td className="px-3 py-2 text-gray-600">{TALEP_TURU_ETIKET[t.talep_turu] ?? t.talep_turu}</td>
                <td className="px-3 py-2 text-gray-600">{t.magazalar?.magaza_adi}</td>
                <td className="px-3 py-2 text-gray-600">{t.pozisyon_tipi ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600">{t.kisi_sayisi ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600">{t.aktif_gonderim_no}/3</td>
                <td className="px-3 py-2">
                  <div className={`font-medium ${durumRenk[t.durum] ?? ""}`}>{t.durum}</div>
                  {t.durum === "DURAKLADI" && redGerekceleri[t.id] && (
                    <div className="text-[11px] text-gray-500 mt-0.5 max-w-[240px]">
                      {redGerekceleri[t.id]}
                    </div>
                  )}
                  {t.durum === "DURAKLADI" && t.aktif_gonderim_no < 3 && (
                    <RevizyonForm talepId={t.id} />
                  )}
                  {t.durum === "DURAKLADI" && t.aktif_gonderim_no >= 3 && (
                    <div className="text-[11px] text-gray-400 mt-0.5">3 deneme doldu, yeni talep açın</div>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-400 font-mono text-xs">
                  {new Date(t.created_at).toLocaleDateString("tr-TR")}
                </td>
              </tr>
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
