import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const SEKMELER = [
  { href: "/ayarlar/kullanicilar", label: "Kullanıcılar" },
  { href: "/ayarlar/veri-aktarim", label: "Veri İçe Aktar" },
  { href: "/ayarlar/magazalar", label: "Mağazalar / Bölgeler / Normlar" },
  { href: "/ayarlar/veriler", label: "İçe Aktarılan Veriler" },
];

export default async function AyarlarLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("rol").eq("email", user.email).single();
  if (me?.rol !== "YONETIM") redirect("/dashboard");

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-semibold text-navy-3">Ayarlar</div>
        <div className="text-xs text-gray-400 mt-0.5">Kullanıcı yönetimi, veri içe aktarma ve sistem ayarları</div>
      </div>
      <div className="flex gap-2 mb-5 border-b border-gray-200">
        {SEKMELER.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="px-3 py-2 text-sm text-gray-500 hover:text-navy border-b-2 border-transparent hover:border-navy/30 transition-colors"
          >
            {s.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
