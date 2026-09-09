"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createKullanici(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const adSoyad = String(formData.get("ad_soyad") ?? "").trim();
  const rol = String(formData.get("rol") ?? "");
  const bolgeIds = formData.getAll("bolge_ids").map(String);

  if (!email || !adSoyad || !rol) return { error: "E-posta, ad soyad ve rol zorunlu." };

  // Bu e-posta zaten kayıtlıysa (örn. birisi var olan bir kullanıcıyı bu
  // formdan tekrar eklemeye çalıştıysa) eskiden burada SESSİZCE hiçbir şey
  // olmadan çıkılıyordu — girilen bölge seçimleri kaybolup hiç hata da
  // gösterilmiyordu. Artık bu durumda yeni kayıt oluşturmak yerine, mevcut
  // kullanıcının rolü ve bölgeleri GÜNCELLENİR — veri asla sessizce kaybolmaz.
  const { data: mevcutKullanici } = await supabase
    .from("kullanicilar").select("id").eq("email", email).maybeSingle();

  if (mevcutKullanici) {
    const fd = new FormData();
    fd.set("id", mevcutKullanici.id);
    fd.set("ad_soyad", adSoyad);
    fd.set("email", email);
    fd.set("rol", rol);
    fd.set("aktif", "true");
    bolgeIds.forEach((id) => fd.append("bolge_ids", id));
    return await guncelleKullanici(fd);
  }

  const { data: yeniKullanici, error } = await supabase
    .from("kullanicilar")
    .insert({ email, ad_soyad: adSoyad, rol })
    .select("id")
    .single();

  if (error || !yeniKullanici) return { error: error?.message ?? "Kullanıcı oluşturulamadı." };

  if (bolgeIds.length > 0) {
    const rows = bolgeIds.map((bolge_id) => ({
      kullanici_id: yeniKullanici.id,
      bolge_id,
    }));
    const { error: bolgeHata } = await supabase.from("kullanici_bolge_atama").insert(rows);
    if (bolgeHata) return { error: "Kullanıcı oluşturuldu ama bölge ataması kaydedilemedi: " + bolgeHata.message };
  }

  revalidatePath("/ayarlar/kullanicilar");
  return {};
}

export async function guncelleKullanici(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();

  const id = String(formData.get("id") ?? "");
  const adSoyad = String(formData.get("ad_soyad") ?? "").trim();
  const yeniEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const rol = String(formData.get("rol") ?? "");
  const aktif = formData.get("aktif") === "true";
  const bolgeIds = formData.getAll("bolge_ids").map(String);
  if (!id || !adSoyad || !yeniEmail || !rol) return { error: "Ad soyad, e-posta ve rol zorunlu." };

  const { data: eskiKayit } = await supabase.from("kullanicilar").select("email").eq("id", id).single();
  if (!eskiKayit) return { error: "Kullanıcı bulunamadı." };
  const eskiEmail = eskiKayit.email;

  // E-posta değişiyorsa, Supabase Auth'taki gerçek giriş e-postası da (admin
  // API ile) senkron güncellenir — aksi halde kullanıcı bir daha giriş
  // yapamaz (auth e-postası ile kullanicilar.email eşleşmediği için).
  if (yeniEmail !== eskiEmail) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    let sayfa = 1;
    let authKullaniciId: string | null = null;
    while (!authKullaniciId) {
      const { data, error } = await admin.auth.admin.listUsers({ page: sayfa, perPage: 200 });
      if (error || !data || data.users.length === 0) break;
      const bulunan = data.users.find((u) => u.email?.toLowerCase() === eskiEmail.toLowerCase());
      if (bulunan) authKullaniciId = bulunan.id;
      else if (data.users.length < 200) break;
      sayfa++;
    }
    if (authKullaniciId) {
      const { error: authHata } = await admin.auth.admin.updateUserById(authKullaniciId, { email: yeniEmail, email_confirm: true });
      if (authHata) return { error: "Auth e-postası güncellenemedi: " + authHata.message };
    }
  }

  await supabase.from("kullanicilar").update({ ad_soyad: adSoyad, email: yeniEmail, rol, aktif }).eq("id", id);

  // Mevcut atamalar silinip yeni seçilenler baştan eklenir (basit ve güvenilir
  // "eşitleme" yöntemi — tek tek fark hesaplamaya gerek kalmaz).
  await supabase.from("kullanici_bolge_atama").delete().eq("kullanici_id", id);
  if (bolgeIds.length > 0) {
    const rows = bolgeIds.map((bolge_id) => ({ kullanici_id: id, bolge_id }));
    const { error: bolgeHata } = await supabase.from("kullanici_bolge_atama").insert(rows);
    // Önceden bu hata sessizce yutuluyordu — bölge kaydı başarısız olsa da
    // (örn. "bir bölgeye en fazla 1 BM" kısıtına çarpılırsa) kullanıcıya
    // hiçbir şey görünmüyordu. Artık hata doğrudan gösteriliyor.
    if (bolgeHata) return { error: "Bölge ataması kaydedilemedi: " + bolgeHata.message };
  }

  // Herhangi bir güncelleme sonrası, bu kişinin mevcut oturumları tamamen
  // sonlandırılır — bir sonraki istekte otomatik çıkışa uğrar, değişen
  // yetkileriyle tekrar giriş yapması gerekir.
  await supabase.rpc("zorla_cikis_yaptir", { p_email: yeniEmail });

  revalidatePath("/ayarlar/kullanicilar");
  return {};
}

export async function toggleAktif(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id"));
  const aktif = formData.get("aktif") === "true";

  await supabase.from("kullanicilar").update({ aktif }).eq("id", id);
  revalidatePath("/ayarlar/kullanicilar");
}
