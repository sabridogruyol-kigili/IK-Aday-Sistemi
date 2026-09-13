"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { BELGE_LISTESI, belgeGorunurMu } from "@/lib/evrakSabitleri";

// Bir işe alım talebi, hedef kişi sayısına ulaşıldığında (adaylar İşe
// Alındı durumuna geçtiğinde) artık otomatik pasife düşmüyor — evrak
// süreci hâlâ devam ediyor olabilir. İK/Yönetim, TÜM işe alınan kişilerin
// evrakları eksiksiz onaylanınca bu fonksiyonu bilinçli olarak çağırıp
// talebi kapatır (pasife düşürür).
export async function iseAlimiTamamla(talepId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || (me.rol !== "IK" && me.rol !== "YONETIM")) return { error: "Bu işlem için yetkiniz yok." };

  const { data: adaylar } = await supabase
    .from("adaylar")
    .select("id, ad_soyad, tc_kimlik_no")
    .eq("talep_id", talepId)
    .eq("durum", "ISE_ALINDI");

  if (!adaylar || adaylar.length === 0) return { error: "Bu talebe bağlı işe alınmış kimse yok." };

  const tcListesi = adaylar.filter((a) => a.tc_kimlik_no).map((a) => a.tc_kimlik_no as string);
  const { data: personeller } = await supabase
    .from("personel")
    .select("id, tc_kimlik_no, evrak_iptal_nedeni")
    .in("tc_kimlik_no", tcListesi);

  const eksikOlanlar: string[] = [];

  for (const aday of adaylar) {
    const personel = (personeller ?? []).find((p) => p.tc_kimlik_no === aday.tc_kimlik_no);
    if (!personel) { eksikOlanlar.push(`${aday.ad_soyad}: personel kaydı bulunamadı`); continue; }
    if (personel.evrak_iptal_nedeni) { eksikOlanlar.push(`${aday.ad_soyad}: işe alımı iptal edilmiş`); continue; }

    const { data: bilgi } = await supabase.from("personel_evrak_bilgileri").select("cinsiyet").eq("personel_id", personel.id).maybeSingle();
    const { data: belgelerHam } = await supabase.from("personel_evrak_belgeleri").select("belge_tipi, durum").eq("personel_id", personel.id);
    const gerekliBelgeler = BELGE_LISTESI.filter((b) => !b.istegeBagli && belgeGorunurMu(b, bilgi?.cinsiyet ?? null));
    const onaylanan = gerekliBelgeler.filter((b) => (belgelerHam ?? []).find((s: any) => s.belge_tipi === b.id)?.durum === "ONAYLANDI").length;
    if (gerekliBelgeler.length === 0 || onaylanan < gerekliBelgeler.length) {
      eksikOlanlar.push(`${aday.ad_soyad}: evrak eksik (${onaylanan}/${gerekliBelgeler.length})`);
    }
  }

  if (eksikOlanlar.length > 0) {
    return { error: "Tüm evraklar tamamlanmadan işe alım kapatılamaz: " + eksikOlanlar.join("; ") };
  }

  const { error } = await supabase
    .from("talepler")
    .update({ ise_alimi_tamamlandi_tarihi: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", talepId);
  if (error) return { error: error.message };

  revalidatePath("/talepler");
  revalidatePath("/evrak-onay");
  return {};
}

export async function revizeGonder(formData: FormData) {
  const supabase = createClient();
  const talepId = String(formData.get("talep_id"));
  const aciklama = String(formData.get("aciklama") ?? "").trim();

  const { error } = await supabase.rpc("revizyon_gonder", {
    p_talep_id: talepId,
    p_aciklama: aciklama,
  });

  revalidatePath("/talepler");
  revalidatePath("/onay-bekleyenler");
  return { error: error?.message };
}

export type SurecAdimi = {
  baslik: string;
  tarih: string | null;
  detay?: string | null;
  durum: "TAMAMLANDI_OLUMLU" | "TAMAMLANDI_OLUMSUZ" | "TAMAMLANDI_NOTR" | "MEVCUT" | "GELECEK";
};

export async function getTalepTarihcesi(talepId: string): Promise<{ data: SurecAdimi[]; error?: string }> {
  const supabase = createClient();

  const { data: talep, error: talepHata } = await supabase
    .from("talepler")
    .select("talep_no, created_at, durum, aktif_gonderim_no, acan:kullanicilar!acan_kullanici_id(ad_soyad, rol)")
    .eq("id", talepId)
    .single();
  if (talepHata || !talep) return { data: [], error: talepHata?.message ?? "Talep bulunamadı." };

  const { data: gonderimler } = await supabase
    .from("talep_gonderimler")
    .select("id, gonderim_no, aciklama, norm_kontrol_sonucu, created_at")
    .eq("talep_id", talepId)
    .order("gonderim_no");
  const g = gonderimler ?? [];

  const gonderimIdleri = g.map((x) => x.id);
  const { data: onaylarHam } = gonderimIdleri.length > 0
    ? await supabase
        .from("talep_onaylari")
        .select("gonderim_id, onaylayici_rol_baglami, karar, aciklama, karar_tarihi, kullanicilar!onaylayici_kullanici_id(ad_soyad)")
        .in("gonderim_id", gonderimIdleri)
    : { data: [] as any[] };
  const onaylar = onaylarHam ?? [];

  const adimlar: SurecAdimi[] = [];

  adimlar.push({
    tarih: talep.created_at,
    baslik: `Talep Açıldı — ${(talep.acan as any)?.ad_soyad ?? "?"} (${(talep.acan as any)?.rol ?? "?"})`,
    durum: "TAMAMLANDI_NOTR",
  });

  g.forEach((gonderim) => {
    if (gonderim.gonderim_no > 1) {
      adimlar.push({
        tarih: gonderim.created_at,
        baslik: `${gonderim.gonderim_no}. Gönderim (Revizyon)`,
        detay: gonderim.aciklama,
        durum: "TAMAMLANDI_NOTR",
      });
    }

    const buGonderimAktif = gonderim.gonderim_no === talep.aktif_gonderim_no;
    const buGonderimOnaylari = onaylar.filter((o: any) => o.gonderim_id === gonderim.id);

    // Geçmişte kalan (aktif olmayan) gönderimlerde sadece karar verilmiş onaylar gösterilir.
    // Aktif gönderimde ise henüz karar vermeyenler de "MEVCUT" (bekleniyor) olarak listelenir.
    buGonderimOnaylari.forEach((o: any) => {
      if (o.karar) {
        adimlar.push({
          tarih: o.karar_tarihi,
          baslik: `${o.kullanicilar?.ad_soyad ?? "?"} (${o.onaylayici_rol_baglami}) — ${o.karar === "ONAY" ? "Onayladı" : "Reddetti"}`,
          detay: o.aciklama,
          durum: o.karar === "ONAY" ? "TAMAMLANDI_OLUMLU" : "TAMAMLANDI_OLUMSUZ",
        });
      } else if (buGonderimAktif && (talep.durum === "BEKLEMEDE" || talep.durum === "ISLEME_DEVAM")) {
        adimlar.push({
          tarih: null,
          baslik: `${o.kullanicilar?.ad_soyad ?? "?"} (${o.onaylayici_rol_baglami}) — Bekleniyor`,
          durum: "MEVCUT",
        });
      }
    });
  });

  if (talep.durum === "KABUL_EDILDI") {
    adimlar.push({ tarih: null, baslik: "Sonuç — Kabul Edildi", durum: "TAMAMLANDI_OLUMLU" });
  } else if (talep.durum === "KAPANDI_RED") {
    adimlar.push({ tarih: null, baslik: "Sonuç — Kapandı (Red)", durum: "TAMAMLANDI_OLUMSUZ" });
  } else if (talep.durum === "DURAKLADI") {
    if (talep.aktif_gonderim_no >= 3) {
      adimlar.push({ tarih: null, baslik: "Sonuç — Kapanacak (3 deneme doldu)", durum: "MEVCUT" });
    } else {
      adimlar.push({ tarih: null, baslik: "Revizyon Gönderimi Bekleniyor", durum: "MEVCUT" });
    }
  } else {
    adimlar.push({ tarih: null, baslik: "Sonuç Bekleniyor", durum: "GELECEK" });
  }

  return { data: adimlar };
}
