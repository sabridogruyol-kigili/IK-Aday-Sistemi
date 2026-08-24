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
