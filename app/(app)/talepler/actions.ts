"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

export type TarihceOlay = {
  tarih: string;
  baslik: string;
  detay?: string | null;
};

export async function getTalepTarihcesi(talepId: string): Promise<{ data: TarihceOlay[]; error?: string }> {
  const supabase = createClient();

  const { data: talep, error: talepHata } = await supabase
    .from("talepler")
    .select("talep_no, created_at, durum, acan:kullanicilar!acan_kullanici_id(ad_soyad, rol)")
    .eq("id", talepId)
    .single();
  if (talepHata || !talep) return { data: [], error: talepHata?.message ?? "Talep bulunamadı." };

  const { data: gonderimler } = await supabase
    .from("talep_gonderimler")
    .select("id, gonderim_no, aciklama, norm_kontrol_sonucu, created_at")
    .eq("talep_id", talepId)
    .order("gonderim_no");

  const gonderimIdleri = (gonderimler ?? []).map((g) => g.id);

  const { data: onaylar } = gonderimIdleri.length > 0
    ? await supabase
        .from("talep_onaylari")
        .select("gonderim_id, onaylayici_rol_baglami, karar, aciklama, karar_tarihi, kullanicilar!onaylayici_kullanici_id(ad_soyad)")
        .in("gonderim_id", gonderimIdleri)
        .order("karar_tarihi")
    : { data: [] as any[] };

  const olaylar: TarihceOlay[] = [];

  olaylar.push({
    tarih: talep.created_at,
    baslik: `Talep açıldı — ${(talep.acan as any)?.ad_soyad ?? "?"} (${(talep.acan as any)?.rol ?? "?"})`,
  });

  (gonderimler ?? []).forEach((g) => {
    if (g.gonderim_no > 1) {
      olaylar.push({
        tarih: g.created_at,
        baslik: `${g.gonderim_no}. gönderim (revizyon)`,
        detay: g.aciklama,
      });
    }
    const buGonderimOnaylari = (onaylar ?? []).filter((o: any) => o.gonderim_id === g.id && o.karar);
    buGonderimOnaylari.forEach((o: any) => {
      olaylar.push({
        tarih: o.karar_tarihi,
        baslik: `${o.kullanicilar?.ad_soyad ?? "?"} (${o.onaylayici_rol_baglami}) — ${o.karar === "ONAY" ? "Onayladı" : "Reddetti"}`,
        detay: o.aciklama,
      });
    });
  });

  if (talep.durum === "KABUL_EDILDI" || talep.durum === "KAPANDI_RED") {
    // Son durumun kendisi zaten yukarıdaki son onay/red olayında görünüyor, ayrı satır eklemiyoruz.
  }

  olaylar.sort((a, b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime());

  return { data: olaylar };
}
