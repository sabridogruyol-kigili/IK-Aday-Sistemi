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

  // Bu e-posta zaten kayıtlıysa (örn. birisi var olan bir kullanıcıyı bu
  // formdan tekrar eklemeye çalıştıysa) eskiden burada SESSİZCE hiçbir şey
  // olmadan çıkılıyordu — girilen bölge seçimleri kaybolup hiç hata da
  // gösterilmiyordu. Artık bu durumda yeni kayıt oluşturmak yerine, mevcut
  // kullanıcının rolü ve bölgeleri GÜNCELLENİR — veri asla sessizce kaybolmaz.
  const { data: mevcutKullanici } = await supabase
    .from("kullanicilar").select("id").eq("email", email).maybeSingle();

  if (mevcutKullanici) {
    await guncelleKullanici(
      (() => {
        const fd = new FormData();
        fd.set("id", mevcutKullanici.id);
        fd.set("rol", rol);
        bolgeIds.forEach((id) => fd.append("bolge_ids", id));
        return fd;
      })()
    );
    return;
  }

  const { data: yeniKullanici, error } = await supabase
    .from("kullanicilar")
    .insert({ email, ad_soyad: adSoyad, rol })
    .select("id")
    .single();

  if (error || !yeniKullanici) return;

  if (bolgeIds.length > 0) {
    const rows = bolgeIds.map((bolge_id) => ({
      kullanici_id: yeniKullanici.id,
      bolge_id,
    }));
    await supabase.from("kullanici_bolge_atama").insert(rows);
  }

  revalidatePath("/ayarlar/kullanicilar");
}

export async function guncelleKullanici(formData: FormData) {
  const supabase = createClient();

  const id = String(formData.get("id") ?? "");
  const rol = String(formData.get("rol") ?? "");
  const bolgeIds = formData.getAll("bolge_ids").map(String);
  if (!id || !rol) return;

  await supabase.from("kullanicilar").update({ rol }).eq("id", id);

  // Mevcut atamalar silinip yeni seçilenler baştan eklenir (basit ve güvenilir
  // "eşitleme" yöntemi — tek tek fark hesaplamaya gerek kalmaz).
  await supabase.from("kullanici_bolge_atama").delete().eq("kullanici_id", id);
  if (bolgeIds.length > 0) {
    const rows = bolgeIds.map((bolge_id) => ({ kullanici_id: id, bolge_id }));
    await supabase.from("kullanici_bolge_atama").insert(rows);
  }

  revalidatePath("/ayarlar/kullanicilar");
}

export async function toggleAktif(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id"));
  const aktif = formData.get("aktif") === "true";

  await supabase.from("kullanicilar").update({ aktif }).eq("id", id);
  revalidatePath("/ayarlar/kullanicilar");
}
