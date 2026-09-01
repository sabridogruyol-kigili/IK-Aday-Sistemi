"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPerformansAylikDurum(yil: number): Promise<number[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") return [];

  const { data } = await supabase
    .from("performans_magaza_aylik")
    .select("ay")
    .eq("yil", yil);

  return Array.from(new Set((data ?? []).map((r: any) => r.ay))).sort((a, b) => a - b);
}
