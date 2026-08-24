"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type Sonuc = { error?: string; norm_uyari?: string };
const KATEGORI_NORM_ALAN: Record<string, "ana_kadro_norm" | "donemsel_norm" | "part_time_norm"> = {
  ANA_KADRO: "ana_kadro_norm", DONEMSEL: "donemsel_norm", PART_TIME: "part_time_norm",
};

export async function createRotasyonTalebi(formData: FormData): Promise<Sonuc> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return { error: "Kullanıcı bulunamadı." };

  const personelId = String(formData.get("personel_id") ?? "");
  const hedefMagazaId = String(formData.get("hedef_magaza_id") ?? "");
  const aciklama = String(formData.get("aciklama") ?? "").trim();
  const israrli = formData.get("israrli") === "true";

  if (!personelId || !hedefMagazaId) return { error: "Personel ve hedef mağaza zorunlu." };

  const { data: personel } = await supabase
    .from("personel")
    .select("id, ad_soyad, guncel_magaza_id, kadro_kategorisi")
    .eq("id", personelId).single();
  if (!personel) return { error: "Personel bulunamadı." };
  if (personel.guncel_magaza_id === hedefMagazaId) return { error: "Hedef mağaza, mevcut mağazayla aynı olamaz." };
  if (!personel.kadro_kategorisi) return { error: "Bu personelin kadro kategorisi tanımlı değil, önce onu düzeltin." };

  const kategori = personel.kadro_kategorisi;
  const normAlan = KATEGORI_NORM_ALAN[kategori];

  const { data: hedefNorm } = await supabase
    .from("norm").select(normAlan).eq("magaza_id", hedefMagazaId).single();
  const toplamNorm = (hedefNorm as any)?.[normAlan] ?? 0;

  const { count: hedefAktifSayi } = await supabase
    .from("personel").select("*", { count: "exact", head: true })
    .eq("guncel_magaza_id", hedefMagazaId).eq("durum", "aktif").eq("kadro_kategorisi", kategori);

  const kalanKontenjan = toplamNorm - (hedefAktifSayi ?? 0);
  const uygun = kalanKontenjan >= 1;

  if (!uygun && !israrli) {
    return { norm_uyari: `Hedef mağazada ${kategori} kategorisinde kontenjan yok — norm: ${toplamNorm}, dolu: ${hedefAktifSayi ?? 0}.` };
  }
  if (!uygun && israrli && !aciklama) {
    return { error: "Norm aşıldığı için açıklama zorunlu." };
  }

  const { data: talepNo } = await supabase.rpc("sonraki_talep_no");
  if (!talepNo) return { error: "Talep numarası üretilemedi." };

  const { data: yeniTalep, error: talepHata } = await supabase
    .from("talepler")
    .insert({
      talep_no: talepNo, talep_turu: "ROTASYON",
      magaza_id: personel.guncel_magaza_id, hedef_magaza_id: hedefMagazaId,
      acan_kullanici_id: me.id, acan_rol: me.rol,
      cikarilacak_personel_id: personelId,
      durum: "BEKLEMEDE", aktif_gonderim_no: 1,
    })
    .select("id").single();
  if (talepHata || !yeniTalep) return { error: "Talep oluşturulamadı: " + talepHata?.message };

  const { data: gonderim, error: gonderimHata } = await supabase
    .from("talep_gonderimler")
    .insert({ talep_id: yeniTalep.id, gonderim_no: 1, aciklama: aciklama || null,
      norm_kontrol_sonucu: uygun ? "UYGUN" : "UYGUN_DEGIL_ISRARLI" })
    .select("id").single();
  if (gonderimHata || !gonderim) return { error: "Gönderim kaydı oluşturulamadı." };

  const { data: kaynakMagaza } = await supabase.from("magazalar").select("bolge_id").eq("id", personel.guncel_magaza_id).single();
  const { data: hedefMagaza } = await supabase.from("magazalar").select("bolge_id").eq("id", hedefMagazaId).single();

  const roleMap = new Map<string, string>();

  const { data: kaynakBm } = await supabase.from("kullanici_bolge_atama")
    .select("kullanici_id, kullanicilar!inner(rol, aktif)")
    .eq("bolge_id", kaynakMagaza?.bolge_id).eq("kullanicilar.rol", "BM").eq("kullanicilar.aktif", true);
  (kaynakBm ?? []).forEach((r: any) => { if (!roleMap.has(r.kullanici_id)) roleMap.set(r.kullanici_id, "KAYNAK_BM"); });

  const { data: hedefBm } = await supabase.from("kullanici_bolge_atama")
    .select("kullanici_id, kullanicilar!inner(rol, aktif)")
    .eq("bolge_id", hedefMagaza?.bolge_id).eq("kullanicilar.rol", "BM").eq("kullanicilar.aktif", true);
  (hedefBm ?? []).forEach((r: any) => { if (!roleMap.has(r.kullanici_id)) roleMap.set(r.kullanici_id, "HEDEF_BM"); });

  const { data: kaynakIk } = await supabase.from("kullanici_bolge_atama")
    .select("kullanici_id, kullanicilar!inner(rol, aktif)")
    .eq("bolge_id", kaynakMagaza?.bolge_id).eq("kullanicilar.rol", "IK").eq("kullanicilar.aktif", true);
  (kaynakIk ?? []).forEach((r: any) => { if (!roleMap.has(r.kullanici_id)) roleMap.set(r.kullanici_id, "KAYNAK_IK"); });

  const { data: hedefIk } = await supabase.from("kullanici_bolge_atama")
    .select("kullanici_id, kullanicilar!inner(rol, aktif)")
    .eq("bolge_id", hedefMagaza?.bolge_id).eq("kullanicilar.rol", "IK").eq("kullanicilar.aktif", true);
  (hedefIk ?? []).forEach((r: any) => { if (!roleMap.has(r.kullanici_id)) roleMap.set(r.kullanici_id, "HEDEF_IK"); });

  const { data: yonetimler } = await supabase.from("kullanicilar").select("id").eq("rol", "YONETIM").eq("aktif", true);
  (yonetimler ?? []).forEach((y) => { if (!roleMap.has(y.id)) roleMap.set(y.id, "YONETIM"); });

  roleMap.delete(me.id); // açan taraf kendi talebini onaylamaz

  const onaySatirlari = Array.from(roleMap.entries()).map(([kullanici_id, rol]) => ({
    gonderim_id: gonderim.id, onaylayici_kullanici_id: kullanici_id, onaylayici_rol_baglami: rol,
  }));

  if (onaySatirlari.length > 0) {
    await supabase.from("talep_onaylari").insert(onaySatirlari);
  }

  revalidatePath("/talepler");
  redirect("/talepler");
}
