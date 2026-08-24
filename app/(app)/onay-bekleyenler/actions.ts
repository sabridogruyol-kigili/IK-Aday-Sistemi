"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function kararVer(formData: FormData) {
  const supabase = createClient();
  const onayId = String(formData.get("onay_id"));
  const karar = String(formData.get("karar"));
  const aciklama = String(formData.get("aciklama") ?? "").trim();

  const { error } = await supabase.rpc("karar_ver", {
    p_onay_id: onayId,
    p_karar: karar,
    p_aciklama: aciklama || null,
  });

  revalidatePath("/onay-bekleyenler");
  revalidatePath("/talepler");
  return { error: error?.message };
}
