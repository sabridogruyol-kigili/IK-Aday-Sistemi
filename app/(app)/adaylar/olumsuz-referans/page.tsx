import { createClient } from "@/lib/supabase/server";
import { getOlumsuzReferansListesi } from "./actions";
import OlumsuzReferansTablosu from "./OlumsuzReferansTablosu";

export default async function OlumsuzReferansPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("kullanicilar").select("rol").eq("email", user.email).single()
    : { data: null };

  const kayitlar = await getOlumsuzReferansListesi();

  return <OlumsuzReferansTablosu kayitlar={kayitlar} rol={me?.rol ?? ""} />;
}
