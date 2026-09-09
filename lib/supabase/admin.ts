// Sadece SUNUCU tarafında, admin işlemleri (kullanıcı e-postasını değiştirme
// vb.) için kullanılacak yükseltilmiş yetkili istemci. Tarayıcıya asla
// gönderilmez — service_role anahtarı bu dosyanın dışına çıkmamalı.
//
// GEREKLİ ORTAM DEĞİŞKENİ: SUPABASE_SERVICE_ROLE_KEY
// (Supabase Dashboard > Project Settings > API > service_role anahtarı)
// Bu değişkeni Vercel'de Environment Variables kısmına eklemeniz gerekiyor —
// NEXT_PUBLIC_ önekini KULLANMAYIN, bu anahtar gizli kalmalı.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
