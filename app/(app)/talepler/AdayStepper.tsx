"use client";

const ADIMLAR = ["Yönlendirildi", "Karar", "Görüşme", "Sonuç", "İşe Alındı"];

function adimDurumlari(durum: string): ("done" | "active" | "fail" | "pending")[] {
  switch (durum) {
    case "YONLENDIRILDI": return ["done", "active", "pending", "pending", "pending"];
    case "REDDEDILDI": return ["done", "fail", "pending", "pending", "pending"];
    case "ONAYLANDI": return ["done", "done", "active", "pending", "pending"];
    case "ON_GORUSME_PLANLANDI": return ["done", "done", "done", "active", "pending"];
    case "GORUSULDU_OLUMLU": return ["done", "done", "done", "done", "active"];
    case "GORUSULDU_OLUMSUZ": return ["done", "done", "done", "fail", "pending"];
    case "ISE_ALINDI": return ["done", "done", "done", "done", "done"];
    default: return ["pending", "pending", "pending", "pending", "pending"];
  }
}

const RENK: Record<string, string> = {
  done: "bg-success",
  active: "bg-accent",
  fail: "bg-danger",
  pending: "bg-gray-200",
};

export default function AdayStepper({ durum }: { durum: string }) {
  const adimlar = adimDurumlari(durum);
  return (
    <div className="flex items-center gap-1">
      {adimlar.map((s, i) => (
        <span key={i} className={`h-1.5 w-5 rounded-full ${RENK[s]}`} title={ADIMLAR[i]} />
      ))}
    </div>
  );
}
