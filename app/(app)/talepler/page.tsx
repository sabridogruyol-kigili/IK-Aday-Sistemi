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
    .select("id, talep_no, talep_turu, pozisyon_tipi, kisi_sayisi, durum, aktif_gonderim_no, created_at, acan_kullanici_id, magaza_grup_id, magazalar!magaza_id(magaza_adi), acan:kullanicilar!acan_kullanici_id(ad_soyad, rol)")
    .order("created_at", { ascending: false });

  if (talepHata) {
    return <div className="text-xs text-danger">Hata: {talepHata.message}</div>;
  }

  const talepIdleri = (talepler ?? []).map((t: any) => t.id);
  const duraklamislar = (talepler ?? []).filter((t: any) => t.durum === "DURAKLADI");
  const isealimKabulIdleri = (talepler ?? [])
    .filter((t: any) => t.talep_turu === "ISE_ALIM" && t.durum === "KABUL_EDILDI")
    .map((t: any) => t.id);

  // 3 paralel sorgu (döngü yok)
  const [gonderimlerRes, adaylarRes] = await Promise.all([
    duraklamislar.length > 0
      ? supabase.from("talep_gonderimler").select("id, talep_id, gonderim_no").in("talep_id", duraklamislar.map((t: any) => t.id))
      : Promise.resolve({ data: [] as any[] }),
    isealimKabulIdleri.length > 0
      ? supabase.from("adaylar").select("talep_id, durum").in("talep_id", isealimKabulIdleri)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Duraklamış taleplerin aktif gönderimine ait id'leri bul
  const aktifGonderimIdMap: Record<string, string> = {};
  (gonderimlerRes.data ?? []).forEach((g: any) => {
    const talep = duraklamislar.find((t: any) => t.id === g.talep_id);
    if (talep && g.gonderim_no === talep.aktif_gonderim_no) {
      aktifGonderimIdMap[talep.id] = g.id;
    }
  });

  const gonderimIdleri = Object.values(aktifGonderimIdMap);
  const { data: redOnaylar } = gonderimIdleri.length > 0
    ? await supabase
        .from("talep_onaylari")
        .select("gonderim_id, aciklama, onaylayici_rol_baglami")
        .in("gonderim_id", gonderimIdleri)
        .eq("karar", "RED")
    : { data: [] as any[] };

  const redGerekceleri: Record<string, string> = {};
  Object.entries(aktifGonderimIdMap).forEach(([talepId, gonderimId]) => {
    const red = (redOnaylar ?? []).find((r: any) => r.gonderim_id === gonderimId);
    if (red) redGerekceleri[talepId] = `${red.onaylayici_rol_baglami}: ${red.aciklama}`;
  });

  // Aday sayıları ve işe alınan sayıları JS'te grupla
  const adaySayilari: Record<string, number> = {};
  const iseAlinanSayilari: Record<string, number> = {};
  (adaylarRes.data ?? []).forEach((a: any) => {
    adaySayilari[a.talep_id] = (adaySayilari[a.talep_id] ?? 0) + 1;
    if (a.durum === "ISE_ALINDI") {
      iseAlinanSayilari[a.talep_id] = (iseAlinanSayilari[a.talep_id] ?? 0) + 1;
    }
  });

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
