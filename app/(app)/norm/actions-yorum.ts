"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type MagazaYorum = {
  id: string;
  yorum: string;
  yazan_ad_soyad: string;
  yazan_rol: string;
  created_at: string;
};

// Tüm mağazalar için, her rolün (İK/BM/Yönetim) EN SON yorumunu tek seferde
// getirir — Norm tablosundaki 3 sütunda önizleme olarak gösterilir.
// magazaId -> { IK: son yorum, BM: son yorum, YONETIM: son yorum }
export async function getSonYorumlarHepsi(): Promise<Record<string, Partial<Record<"IK" | "BM" | "YONETIM", MagazaYorum>>>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("magaza_yorumlari")
    .select("id, magaza_id, rol, yorum, created_at, yazan:kullanicilar!yazan_kullanici_id(ad_soyad, rol)")
    .order("created_at", { ascending: false });
  if (error || !data) return {};

  const sonuc: Record<string, Partial<Record<"IK" | "BM" | "YONETIM", MagazaYorum>>> = {};
  for (const row of data as any[]) {
    if (!sonuc[row.magaza_id]) sonuc[row.magaza_id] = {};
    // created_at DESC sıralı geldiği için, bir (magaza_id, rol) çiftini
    // İLK gördüğümüz an, o zaten en güncel olandır — sonrakileri atlıyoruz.
    if (sonuc[row.magaza_id][row.rol as "IK" | "BM" | "YONETIM"]) continue;
    sonuc[row.magaza_id][row.rol as "IK" | "BM" | "YONETIM"] = {
      id: row.id, yorum: row.yorum, created_at: row.created_at,
      yazan_ad_soyad: row.yazan?.ad_soyad ?? "—", yazan_rol: row.yazan?.rol ?? row.rol,
    };
  }
  return sonuc;
}

// Tek bir mağazanın, tek bir rolüne ait TÜM yorum geçmişini (en yeniden
// eskiye) getirir — "Detay" modalında gösterilir.
export async function getMagazaYorumGecmisi(magazaId: string, rol: "IK" | "BM" | "YONETIM"): Promise<MagazaYorum[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("magaza_yorumlari")
    .select("id, yorum, created_at, yazan:kullanicilar!yazan_kullanici_id(ad_soyad, rol)")
    .eq("magaza_id", magazaId)
    .eq("rol", rol)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map((row) => ({
    id: row.id, yorum: row.yorum, created_at: row.created_at,
    yazan_ad_soyad: row.yazan?.ad_soyad ?? "—", yazan_rol: row.yazan?.rol ?? rol,
  }));
}

// Yeni bir yorum ekler — ÜZERİNE YAZMAZ, yeni bir satır olarak eklenir,
// böylece geçmiş korunur. Hangi role yazıldığı, o an giriş yapmış
// kullanıcının KENDİ rolünden belirlenir (istemciden gelen bir rol
// parametresine güvenilmez) — bir BM, "Yönetim Yorum" sütununa yazamaz.
export async function magazaYorumEkle(magazaId: string, yorum: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) return { error: "Kullanıcı bulunamadı." };
  if (!["IK", "BM", "YONETIM"].includes(me.rol)) {
    return { error: "Bu bölüme yorum ekleme yetkiniz yok." };
  }

  const temizYorum = yorum.trim();
  if (!temizYorum) return { error: "Yorum boş olamaz." };

  const { error } = await supabase.from("magaza_yorumlari").insert({
    magaza_id: magazaId, rol: me.rol, yorum: temizYorum, yazan_kullanici_id: me.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/norm");
  return {};
}
