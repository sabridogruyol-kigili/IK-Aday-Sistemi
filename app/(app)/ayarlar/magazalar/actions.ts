"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function yonetimMi(): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Giriş yapmalısınız." };
  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return { ok: false, error: "Bu işlem için Yönetim yetkisi gerekiyor." };
  return { ok: true };
}

// ---------------- Bölgeler ----------------

export async function ekleBolge(formData: FormData) {
  const yetki = await yonetimMi();
  if (!yetki.ok) return { error: yetki.error };

  const ad = String(formData.get("ad") ?? "").trim();
  if (!ad) return { error: "Bölge adı zorunlu." };

  const supabase = createClient();
  const { error } = await supabase.from("bolgeler").insert({ ad });
  if (error) return { error: error.message.includes("duplicate") ? "Bu bölge adı zaten kayıtlı." : error.message };

  revalidatePath("/ayarlar/magazalar");
  return { error: undefined };
}

export async function silBolge(formData: FormData) {
  const yetki = await yonetimMi();
  if (!yetki.ok) return { error: yetki.error };

  const id = String(formData.get("id"));
  const supabase = createClient();

  const { count } = await supabase.from("magazalar").select("*", { count: "exact", head: true }).eq("bolge_id", id);
  if ((count ?? 0) > 0) {
    return { error: `Bu bölgeye bağlı ${count} mağaza var — önce mağazaları başka bölgeye taşıyın veya pasif yapın.` };
  }

  const { error } = await supabase.from("bolgeler").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/magazalar");
  return { error: undefined };
}

export async function guncelleBolgeAdi(formData: FormData) {
  const yetki = await yonetimMi();
  if (!yetki.ok) return { error: yetki.error };

  const id = String(formData.get("id"));
  const ad = String(formData.get("ad") ?? "").trim();
  if (!ad) return { error: "Bölge adı boş olamaz." };

  const supabase = createClient();
  const { error } = await supabase.from("bolgeler").update({ ad }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/magazalar");
  return { error: undefined };
}

// ---------------- Mağazalar + Norm ----------------

export type MagazaGuncelleGirdi = {
  id: string;
  magaza_kodu: string;
  magaza_adi: string;
  bolge_id: string;
  subetipi: string | null;
  net_m2: number | null;
  aktif: boolean;
  ana_kadro_norm: number;
  donemsel_norm: number;
  part_time_norm: number;
};

export async function guncelleMagaza(girdi: MagazaGuncelleGirdi) {
  const yetki = await yonetimMi();
  if (!yetki.ok) return { error: yetki.error };

  if (!girdi.magaza_kodu.trim() || !girdi.magaza_adi.trim() || !girdi.bolge_id) {
    return { error: "Mağaza Kodu, Mağaza Adı ve Bölge zorunlu." };
  }

  const supabase = createClient();

  const { error: magazaHata } = await supabase
    .from("magazalar")
    .update({
      magaza_kodu: girdi.magaza_kodu.trim(),
      magaza_adi: girdi.magaza_adi.trim(),
      bolge_id: girdi.bolge_id,
      subetipi: girdi.subetipi,
      net_m2: girdi.net_m2,
      aktif: girdi.aktif,
      updated_at: new Date().toISOString(),
    })
    .eq("id", girdi.id);
  if (magazaHata) return { error: "Mağaza güncellenemedi: " + magazaHata.message };

  const { error: normHata } = await supabase
    .from("norm")
    .upsert(
      {
        magaza_id: girdi.id,
        ana_kadro_norm: girdi.ana_kadro_norm,
        donemsel_norm: girdi.donemsel_norm,
        part_time_norm: girdi.part_time_norm,
        kaynak: "manuel",
      },
      { onConflict: "magaza_id" }
    );
  if (normHata) return { error: "Norm güncellenemedi: " + normHata.message };

  revalidatePath("/ayarlar/magazalar");
  revalidatePath("/norm");
  revalidatePath("/dashboard");
  return { error: undefined };
}

export async function ekleMagaza(girdi: Omit<MagazaGuncelleGirdi, "id">) {
  const yetki = await yonetimMi();
  if (!yetki.ok) return { error: yetki.error };

  if (!girdi.magaza_kodu.trim() || !girdi.magaza_adi.trim() || !girdi.bolge_id) {
    return { error: "Mağaza Kodu, Mağaza Adı ve Bölge zorunlu." };
  }

  const supabase = createClient();

  const { data: yeniMagaza, error: magazaHata } = await supabase
    .from("magazalar")
    .insert({
      magaza_kodu: girdi.magaza_kodu.trim(),
      magaza_adi: girdi.magaza_adi.trim(),
      bolge_id: girdi.bolge_id,
      subetipi: girdi.subetipi,
      net_m2: girdi.net_m2,
      aktif: girdi.aktif,
    })
    .select("id")
    .single();
  if (magazaHata || !yeniMagaza) {
    return { error: "Mağaza oluşturulamadı: " + (magazaHata?.message.includes("duplicate") ? "Bu mağaza kodu zaten kayıtlı." : magazaHata?.message) };
  }

  const { error: normHata } = await supabase.from("norm").insert({
    magaza_id: yeniMagaza.id,
    ana_kadro_norm: girdi.ana_kadro_norm,
    donemsel_norm: girdi.donemsel_norm,
    part_time_norm: girdi.part_time_norm,
    kaynak: "manuel",
  });
  if (normHata) return { error: "Norm oluşturulamadı: " + normHata.message };

  revalidatePath("/ayarlar/magazalar");
  revalidatePath("/norm");
  revalidatePath("/dashboard");
  return { error: undefined };
}

// Mağaza kalıcı silinmiyor — personel/talep/norm/performans geçmişi buna bağlı olduğu için
// (foreign key kısıtlamaları veri bütünlüğünü bozar). Bunun yerine pasif yapılıyor.
export async function magazayiPasifYap(formData: FormData) {
  const yetki = await yonetimMi();
  if (!yetki.ok) return { error: yetki.error };

  const id = String(formData.get("id"));
  const supabase = createClient();
  const { error } = await supabase.from("magazalar").update({ aktif: false }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ayarlar/magazalar");
  revalidatePath("/norm");
  return { error: undefined };
}
