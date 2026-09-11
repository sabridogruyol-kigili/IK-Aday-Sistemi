import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import IkIletisimFormu from "../maas-bilgileri/IkIletisimFormu";
import EgitimLinkleriYonetimi from "./EgitimLinkleriYonetimi";
import MagazaAdresTablosu from "./MagazaAdresTablosu";

async function tumSatirlariGetir<T>(sorguOlustur: (bas: number, bitis: number) => any): Promise<T[]> {
  const PARCA = 1000;
  let tumSatirlar: T[] = [];
  let sayfa = 0;
  while (true) {
    const bas = sayfa * PARCA;
    const { data, error } = await sorguOlustur(bas, bas + PARCA - 1);
    if (error || !data) break;
    tumSatirlar = tumSatirlar.concat(data as T[]);
    if (data.length < PARCA) break;
    sayfa++;
  }
  return tumSatirlar;
}

export default async function SistemAyarlariPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (!me || me.rol !== "YONETIM") redirect("/dashboard");

  const [{ data: ayar }, { data: egitimler }, magazalar] = await Promise.all([
    supabase.from("sistem_ayarlari").select("ik_website, ik_email, ik_adres, ik_calisma_saatleri").eq("id", 1).single(),
    supabase.from("egitim_linkleri").select("id, baslik, link, sira").order("sira"),
    tumSatirlariGetir<any>((bas, bitis) =>
      supabase.from("magazalar").select("id, magaza_kodu, magaza_adi, adres, konum_link").eq("aktif", true).order("magaza_adi").range(bas, bitis)
    ),
  ]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-sm font-semibold text-navy-3 mb-1">İK İletişim Bilgileri</div>
        <div className="text-xs text-gray-400 mb-3">
          Adayların gördüğü <strong>Evrak Portalı</strong>'nda gösterilen iletişim bilgileri.
        </div>
        <IkIletisimFormu
          mevcutWebsite={ayar?.ik_website ?? ""}
          mevcutEmail={ayar?.ik_email ?? ""}
          mevcutAdres={ayar?.ik_adres ?? ""}
          mevcutCalismaSaatleri={ayar?.ik_calisma_saatleri ?? ""}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-sm font-semibold text-navy-3 mb-1">Zorunlu Eğitim Linkleri</div>
        <div className="text-xs text-gray-400 mb-3">
          İşe başlamadan önce izlenmesi gereken eğitimler — Evrak Portalı'nın Hoş Geldin sayfasında buton olarak gösterilir.
        </div>
        <EgitimLinkleriYonetimi egitimler={egitimler ?? []} />
      </div>

      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="text-sm font-semibold text-navy-3 mb-1">Mağaza Adres / Konum Bilgileri</div>
        <div className="text-xs text-gray-400 mb-3">
          Adayın başlayacağı mağazanın adresi ve konumu — Evrak Portalı'nın Hoş Geldin sayfasında gösterilir. Tek tek buradan düzenleyebilir, ya da Ayarlar &gt; Veri Yönetimi &gt; "Mağaza Adres / Konum" şablonuyla toplu içe aktarabilirsiniz.
        </div>
        <MagazaAdresTablosu magazalar={magazalar} />
      </div>
    </div>
  );
}
