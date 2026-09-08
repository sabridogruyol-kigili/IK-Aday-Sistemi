"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };

export default function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="py-2 flex-1 overflow-y-auto">
      {items.map((item) => {
        // "/talepler" tam eşleşmesin diye "/talepler/yeni" öncelikli kontrol edilir.
        const aktif = item.href === "/talepler"
          ? pathname === "/talepler"
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] border-l-[3px] transition-colors ${
              aktif
                ? "bg-info/15 border-l-info text-white font-medium"
                : "text-white/55 hover:bg-white/10 hover:text-white/90 border-l-transparent"
            }`}
          >
            <span className="w-[15px] text-center text-[13px]">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
