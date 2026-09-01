"use server";

import { createClient } from "@/lib/supabase/server";

export type SonImport = { tip: string; kullanici_adi: string | null; basarili: number; hatali: number; created_at: string };

export async function getSonImportlar(): Promise<Record<string, SonImport>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return {};

  const { data } = await supabase
    .from("import_gecmisi")
    .select("tip, kullanici_adi, basarili, hatali, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const sonuc: Record<string, SonImport> = {};
  (data ?? []).forEach((row: any) => {
    if (!sonuc[row.tip]) sonuc[row.tip] = row;
  });
  return sonuc;
}
