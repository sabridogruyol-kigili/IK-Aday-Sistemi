"use client";

import { useState } from "react";

// KVKK: TC Kimlik No varsayılan olarak maskeli gösterilir (sadece son 2 hane
// açık), göz ikonuna tıklanınca o oturumda geçici olarak tam hali görünür.
export function tcMaskle(tc: string | null | undefined): string {
  if (!tc) return "—";
  const temiz = tc.replace(/\D/g, "");
  if (temiz.length <= 2) return "•".repeat(temiz.length);
  return "•".repeat(temiz.length - 2) + temiz.slice(-2);
}

export default function TcGoster({ tc, className = "" }: { tc: string | null | undefined; className?: string }) {
  const [acik, setAcik] = useState(false);

  if (!tc) return <span className={className}>—</span>;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="font-mono">{acik ? tc : tcMaskle(tc)}</span>
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        title={acik ? "Gizle" : "Göster"}
        className="text-gray-400 hover:text-navy text-[10px] leading-none shrink-0"
      >
        {acik ? "🙈" : "👁"}
      </button>
    </span>
  );
}
