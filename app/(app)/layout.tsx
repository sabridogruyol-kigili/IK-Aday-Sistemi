import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CikisButonu from "./CikisButonu";
import TemaDegistirici from "./TemaDegistirici";
import ProfilKarti from "./ProfilKarti";
import AiAsistan from "./ai/AiAsistan";
import SidebarNav from "./SidebarNav";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/benim-performansim", label: "Performansım", icon: "dashboard" },
  { href: "/norm", label: "HR Connect", icon: "norm" },
  { href: "/talepler/yeni", label: "Yeni Talep", icon: "yeni" },
  { href: "/talepler", label: "Talepler", icon: "talepler" },
  { href: "/onay-bekleyenler", label: "Onay Bekleyenler", icon: "onay" },
  { href: "/personel", label: "Personel Listesi", icon: "personel" },
  { href: "/adaylar", label: "Aday Havuzu", icon: "adaylar" },
  { href: "/evrak-onay", label: "Evrak Onay", icon: "evrak" },
  { href: "/raporlar", label: "Raporlar", icon: "raporlar" },
  { href: "/terfi-degerlendirme", label: "Terfi-Jüri Değerlendirme", icon: "terfi", disHref: "https://kigili-insankaynaklaridirektorlugu-terfi2026.streamlit.app/" },
  { href: "/ayarlar/kullanicilar", label: "Ayarlar", icon: "ayarlar" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: profile } = await supabase
    .from("kullanicilar")
    .select("ad_soyad, rol")
    .eq("email", user.email)
    .single();

  const displayName = profile?.ad_soyad ?? user.email ?? "Kullanıcı";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Mağazalar Direktörlüğü: sadece performans/norm izleme ve onay — talep açma,
  // aday süreci ve sistem ayarlarına erişimi yok.
  const DIREKTOR_GORUNUR_HREFLER = new Set([
    "/dashboard", "/norm", "/talepler", "/onay-bekleyenler", "/personel", "/terfi-degerlendirme",
  ]);

  // Bordro ve Çalışma İlişkileri: hiçbir onay/red yetkisi yok, sadece işe
  // alımı tamamlanmış kişilerin evraklarını görüntüleyip "sisteme girildi"
  // bilgisini kaydeder — aday havuzu, terfi değerlendirme, raporlar ve
  // sistem ayarlarına hiç erişimi yok.
  const BORDRO_GORUNUR_HREFLER = new Set([
    "/dashboard", "/norm", "/onay-bekleyenler", "/talepler", "/personel", "/evrak-onay",
  ]);

  // Çalışan: hiçbir talep/aday/evrak/rapor bilgisine erişimi yok — sadece
  // kendi performansını görebilir ve kendisini ilgilendiren onaylar (örn.
  // bir rotasyon talebinde kendi onayı istendiğinde) için Onay
  // Bekleyenler'e erişir.
  const CALISAN_GORUNUR_HREFLER = new Set(["/benim-performansim", "/onay-bekleyenler"]);

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/ayarlar/kullanicilar" && profile?.rol !== "YONETIM") return false;
    if (item.href === "/evrak-onay" && profile?.rol !== "IK" && profile?.rol !== "YONETIM" && profile?.rol !== "BORDRO") return false;
    if (profile?.rol === "MAGAZALAR_DIREKTORLUGU" && !DIREKTOR_GORUNUR_HREFLER.has(item.href)) return false;
    if (profile?.rol === "BORDRO" && !BORDRO_GORUNUR_HREFLER.has(item.href)) return false;
    if (profile?.rol === "CALISAN" && !CALISAN_GORUNUR_HREFLER.has(item.href)) return false;
    if (item.href === "/benim-performansim" && profile?.rol !== "CALISAN") return false;
    return true;
  });

  return (
    <div className="flex h-screen">
      <aside className="w-[210px] min-w-[210px] bg-navy flex flex-col">
        <div className="px-4 pt-5 pb-4 border-b border-white/10 flex flex-col items-center text-center gap-2 bg-navy-gradient">
          <img src="/logo.png" alt="Kiğılı İK" className="h-28 w-auto" />
          <div className="text-white text-[13px] font-medium leading-tight tracking-wide">
            İnsan Kaynakları Aday ve Süreç Takip Sistemi
          </div>
        </div>
        <SidebarNav items={visibleNavItems} />
        <div className="px-4 py-3 border-t border-white/10 space-y-2.5">
          <div className="text-white/40 text-[9px] uppercase tracking-wide text-center">Organizasyonel Gelişim</div>
          <TemaDegistirici />
          <CikisButonu />
          <ProfilKarti displayName={displayName} rol={profile?.rol ?? ""} initials={initials} />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-[#FAFAF8]">
        <div className="p-5">{children}</div>
      </main>
      <AiAsistan />
    </div>
  );
}
