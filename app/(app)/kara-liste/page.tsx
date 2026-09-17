import { createClient } from "@/lib/supabase/server";
import { getKaraListe } from "./actions";
import KaraListeTablosu from "./KaraListeTablosu";

export default async function KaraListePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("kullanicilar").select("rol").eq("email", user.email).single()
    : { data: null };

  const kayitlar = await getKaraListe();

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Kara Liste</div>
        <div className="text-xs text-gray-400 mt-0.5">
          İşten çıkarılan personelin TC'si buradaysa, aynı kişi yeniden başvurduğunda İşe Al adımında uyarı gösterilir.
        </div>
      </div>
      <KaraListeTablosu kayitlar={kayitlar} rol={me?.rol ?? ""} />
    </div>
  );
}
