import { createClient } from "@/lib/supabase/server";
import { getOlumsuzReferansListesi } from "./actions";
import OlumsuzReferansTablosu from "./OlumsuzReferansTablosu";
import { rolGorebilirMi } from "@/lib/hassasVeri";

export default async function OlumsuzReferansPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("kullanicilar").select("rol").eq("email", user.email).single()
    : { data: null };

  const kayitlar = await getOlumsuzReferansListesi();
  const tcGorebilir = me?.rol ? await rolGorebilirMi(supabase, me.rol, "tc_kimlik_no") : false;

  return <OlumsuzReferansTablosu kayitlar={kayitlar} rol={me?.rol ?? ""} tcGorebilir={tcGorebilir} />;
}
