import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TaleplerTablosu from "./TaleplerTablosu";

export default async function TaleplerPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return null;

  const { data: talepler, error: talepHata } = await supabase
    .from("talepler")
    .select("id, talep_no, talep_turu, pozisyon_tipi, kisi_sayisi, durum, aktif_gonderim_no, created_at, acan_kullanici_id, magazalar!magaza_id(magaza_adi), acan:kullanicilar!acan_kullanici_id(ad_soyad, rol)")
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
  const iseAlinanSayilari: Record<string, number> = {};
  for (const t of talepler ?? []) {
    if (t.talep_turu === "ISE_ALIM" && t.durum === "KABUL_EDILDI") {
      const { count: toplam } = await supabase
        .from("adaylar")
        .select("*", { count: "exact", head: true })
        .eq("talep_id", t.id);
      adaySayilari[t.id] = toplam ?? 0;

      const { count: iseAlinan } = await supabase
        .from("adaylar")
        .select("*", { count: "exact", head: true })
        .eq("talep_id", t.id)
        .eq("durum", "ISE_ALINDI");
      iseAlinanSayilari[t.id] = iseAlinan ?? 0;
    }
  }

  const zenginlestirilmis = (talepler ?? []).map((t: any) => {
    let kategori: "AKTIF" | "PASIF" = "AKTIF";
    let gorunumEtiket: string | undefined;

    if (t.durum === "KAPANDI_RED") {
      kategori = "PASIF";
    } else if (t.talep_turu === "ISE_ALIM") {
      if (t.durum === "KABUL_EDILDI") {
        const iseAlinan = iseAlinanSayilari[t.id] ?? 0;
        const hedef = t.kisi_sayisi ?? 0;
        if (hedef > 0 && iseAlinan >= hedef) {
          kategori = "PASIF";
          gorunumEtiket = "TAMAMLANDI";
        }
      }
    } else {
      // ISTEN_CIKARMA, ROTASYON
      if (t.durum === "KABUL_EDILDI") kategori = "PASIF";
    }

    return {
      ...t,
      kategori,
      gorunumEtiket,
      redGerekce: redGerekceleri[t.id],
      adaySayisi: adaySayilari[t.id] ?? 0,
      benimAcimMi: t.acan_kullanici_id === me.id,
      acanAdi: t.acan?.ad_soyad,
      acanRol: t.acan?.rol,
    };
  });

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Talepler</div>
        <div className="text-xs text-gray-400 mt-0.5">Yetkiniz dahilindeki tüm talepler</div>
      </div>
      <TaleplerTablosu talepler={zenginlestirilmis} benimKullaniciId={me.id} benimRolum={me.rol} />
    </div>
  );
}
