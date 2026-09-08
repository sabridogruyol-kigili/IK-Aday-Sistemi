"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CikisButonu() {
  const [cikisYapiliyor, setCikisYapiliyor] = useState(false);
  const router = useRouter();

  async function cikisYap() {
    setCikisYapiliyor(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={cikisYap}
      disabled={cikisYapiliyor}
      className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium text-white bg-danger hover:bg-danger/85 rounded-md py-1.5 transition-colors disabled:opacity-50"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      {cikisYapiliyor ? "Çıkış yapılıyor..." : "Çıkış"}
    </button>
  );
}
