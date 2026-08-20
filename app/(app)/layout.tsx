import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/norm", label: "Mağazalarım / Norm", icon: "▦" },
  { href: "/talepler/yeni", label: "Yeni Talep", icon: "＋" },
  { href: "/talepler", label: "Taleplerim", icon: "☰" },
  { href: "/onay-bekleyenler", label: "Onay Bekleyenler", icon: "✓" },
  { href: "/personel", label: "Personel Listesi", icon: "◒" },
  { href: "/raporlar", label: "Raporlar", icon: "▤" },
  { href: "/bildirimler", label: "Bildirimler", icon: "🔔" },
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

  return (
    <div className="flex h-screen">
      <aside className="w-[210px] min-w-[210px] bg-navy flex flex-col">
        <div className="px-4 pt-[18px] pb-[14px] border-b border-white/10">
          <div className="w-[34px] h-[34px] bg-accent rounded-[7px] flex items-center justify-center font-bold text-xs text-navy-3 mb-2 tracking-wide">
            QHR
          </div>
          <div className="text-white text-sm font-semibold">Qualis Portal</div>
          <div className="text-white/40 text-[11px] mt-0.5">Norm Kadro</div>
        </div>

        <nav className="py-2 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-4 py-2 text-[13px] text-white/55 hover:bg-white/10 hover:text-white/90 border-l-[3px] border-transparent transition-colors"
            >
              <span className="w-[15px] text-center text-[13px]">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-full bg-accent flex items-center justify-center text-[11px] font-bold text-navy-3 shrink-0">
            {initials}
          </div>
          <div>
            <div className="text-white text-xs font-medium leading-tight">{displayName}</div>
            <div className="text-white/40 text-[10px]">{profile?.rol ?? "—"}</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[#f5f5f3]">
        <div className="p-5">{children}</div>
      </main>
    </div>
  );
}
