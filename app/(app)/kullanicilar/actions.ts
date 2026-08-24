"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createKullanici(formData: FormData) {
  const supabase = createClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const adSoyad = String(formData.get("ad_soyad") ?? "").trim();
  const rol = String(formData.get("rol") ?? "");
  const bolgeIds = formData.getAll("bolge_ids").map(String);

  if (!email || !adSoyad || !rol) return;

  const { data: yeniKullanici, error } = await supabase
    .from("kullanicilar")
    .insert({ email, ad_soyad: adSoyad, rol })
    .select("id")
    .single();

  // RLS izin vermiyorsa (kullanıcı Yönetim değilse) veya email zaten kayıtlıysa
  // burada sessizce çıkıyoruz — UI tarafında hata mesajı göstermek bir sonraki iyileştirme.
  if (error || !yeniKullanici) return;

  if (bolgeIds.length > 0) {
    const rows = bolgeIds.map((bolge_id) => ({
      kullanici_id: yeniKullanici.id,
      bolge_id,
    }));
    await supabase.from("kullanici_bolge_atama").insert(rows);
  }

  revalidatePath("/kullanicilar");
}

export async function toggleAktif(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id"));
  const aktif = formData.get("aktif") === "true";

  await supabase.from("kullanicilar").update({ aktif }).eq("id", id);
  revalidatePath("/kullanicilar");
}
