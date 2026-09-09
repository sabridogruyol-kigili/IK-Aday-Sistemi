"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string; disHref?: string };

// Bağımlılık eklemeden, tek bir çizgi kalınlığı ve stiliyle tutarlı outline
// ikon seti — önceki karışık Unicode sembol + emoji karışımının yerine.
const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>
  ),
  norm: (
    <><line x1="4" y1="20" x2="4" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="20" y1="20" x2="20" y2="14" /></>
  ),
  yeni: (
    <><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>
  ),
  talepler: (
    <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="14" y2="18" /></>
  ),
  onay: (
    <><path d="M20 6 9 17l-5-5" /></>
  ),
  personel: (
    <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17.5" cy="9" r="2.4" /><path d="M15.5 14.2c2.6.4 4.5 2.3 4.5 5.3" /></>
  ),
  adaylar: (
    <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><line x1="18" y1="6" x2="18" y2="12" /><line x1="15" y1="9" x2="21" y2="9" /></>
  ),
  raporlar: (
    <><path d="M4 19V9" /><path d="M11 19V5" /><path d="M18 19v-6" /></>
  ),
  bildirimler: (
    <><path d="M6 9a6 6 0 1 1 12 0c0 4.2 1.2 5.4 1.2 5.4H4.8S6 13.2 6 9Z" /><path d="M10 18.5a2 2 0 0 0 4 0" /></>
  ),
  ayarlar: (
    <><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10c.14.42.42.8 1.55 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></>
  ),
  terfi: (
    <><path d="M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 8.2l5.9-.9L12 2Z" /><path d="M12 22v-4" /></>
  ),
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name] ?? null}
    </svg>
  );
}

export default function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="py-2 flex-1 overflow-y-auto">
      {items.map((item) => {
        // Dış bağlantılar (örn. Streamlit uygulaması) Next.js yönlendirmesinden
        // geçmez, yeni sekmede düz bir <a> ile açılır — aktif/pasif durumu yok.
        if (item.disHref) {
          return (
            <a
              key={item.href}
              href={item.disHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-4 py-2 text-[13px] border-l-[3px] border-l-transparent text-white/55 hover:bg-white/10 hover:text-white/90 transition-colors"
            >
              <span className="w-4 shrink-0 flex items-center justify-center">
                <NavIcon name={item.icon} />
              </span>
              {item.label}
              <span className="text-[9px] text-white/30 ml-auto">↗</span>
            </a>
          );
        }

        // "/talepler" tam eşleşmesin diye "/talepler/yeni" öncelikli kontrol edilir.
        const aktif = item.href === "/talepler"
          ? pathname === "/talepler"
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-4 py-2 text-[13px] border-l-[3px] transition-colors ${
              aktif
                ? "bg-info/15 border-l-info text-white font-medium"
                : "text-white/55 hover:bg-white/10 hover:text-white/90 border-l-transparent"
            }`}
          >
            <span className="w-4 shrink-0 flex items-center justify-center">
              <NavIcon name={item.icon} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
