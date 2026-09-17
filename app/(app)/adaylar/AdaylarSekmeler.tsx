"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SEKMELER = [
  { href: "/adaylar", label: "Aday Havuzu" },
  { href: "/adaylar/olumsuz-referans", label: "Olumsuz Referans Listesi" },
];

export default function AdaylarSekmeler() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 mb-5 border-b border-gray-200">
      {SEKMELER.map((s) => {
        const aktif = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`px-3 py-2 text-sm border-b-2 transition-colors ${
              aktif ? "text-navy-3 font-medium border-navy" : "text-gray-500 border-transparent hover:text-navy hover:border-navy/30"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
