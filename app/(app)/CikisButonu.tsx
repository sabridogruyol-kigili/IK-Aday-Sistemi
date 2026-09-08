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
      title="Çıkış Yap"
      className="text-white/40 hover:text-white/90 text-[16px] shrink-0 disabled:opacity-40 transition-colors"
    >
      {cikisYapiliyor ? "…" : "⎋"}
    </button>
  );
}
