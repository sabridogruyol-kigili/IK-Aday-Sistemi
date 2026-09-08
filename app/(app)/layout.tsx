import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CikisButonu from "./CikisButonu";
import SidebarNav from "./SidebarNav";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/norm", label: "Mağazalarım / Norm", icon: "norm" },
  { href: "/talepler/yeni", label: "Yeni Talep", icon: "yeni" },
  { href: "/talepler", label: "Talepler", icon: "talepler" },
  { href: "/onay-bekleyenler", label: "Onay Bekleyenler", icon: "onay" },
  { href: "/personel", label: "Personel Listesi", icon: "personel" },
  { href: "/adaylar", label: "Adaylar", icon: "adaylar" },
  { href: "/raporlar", label: "Raporlar", icon: "raporlar" },
  { href: "/bildirimler", label: "Bildirimler", icon: "bildirimler" },
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
    "/dashboard", "/norm", "/talepler", "/onay-bekleyenler", "/personel", "/raporlar", "/bildirimler",
  ]);

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/ayarlar/kullanicilar" && profile?.rol !== "YONETIM") return false;
    if (profile?.rol === "MAGAZALAR_DIREKTORLUGU" && !DIREKTOR_GORUNUR_HREFLER.has(item.href)) return false;
    return true;
  });

  return (
    <div className="flex h-screen">
      <aside className="w-[210px] min-w-[210px] bg-navy flex flex-col">
        <div className="px-4 pt-5 pb-4 border-b border-white/10 flex flex-col items-center text-center gap-2">
          <img src="/logo.png" alt="Kiğılı İK" className="h-16 w-auto" />
          <div className="text-white text-[13px] font-medium leading-tight tracking-wide">
            İK Aday ve Süreç Takip Sistemi
          </div>
        </div>
        <SidebarNav items={visibleNavItems} />
        <div className="px-4 py-3 border-t border-white/10 space-y-2.5">
          <CikisButonu />
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-full bg-accent border border-white/20 flex items-center justify-center text-[11px] font-semibold text-navy-3 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium leading-tight truncate">{displayName}</div>
              <div className="text-white/40 text-[10px] tracking-wide">{profile?.rol ?? "—"}</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-[#FAFAF8]">
        <div className="p-5">{children}</div>
      </main>
    </div>
  );
}
