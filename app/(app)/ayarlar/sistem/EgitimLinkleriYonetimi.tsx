"use client";

import { useState } from "react";
import { ekleEgitimLinki, silEgitimLinki } from "./actions";

type Egitim = { id: string; baslik: string; link: string; sira: number };

export default function EgitimLinkleriYonetimi({ egitimler }: { egitimler: Egitim[] }) {
  const [baslik, setBaslik] = useState("");
  const [link, setLink] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [silinenId, setSilinenId] = useState<string | null>(null);

  function ekle() {
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("baslik", baslik);
    fd.set("link", link);
    ekleEgitimLinki(fd).then((res) => {
      setPending(false);
      if (res?.error) { setError(res.error); return; }
      setBaslik(""); setLink("");
    });
  }

  function sil(id: string) {
    setSilinenId(id);
    const fd = new FormData();
    fd.set("id", id);
    silEgitimLinki(fd).then(() => setSilinenId(null));
  }

  return (
    <div>
      <div className="space-y-1.5 mb-3">
        {egitimler.map((e) => (
          <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm text-navy-3 font-medium">{e.baslik}</div>
              <div className="text-[11px] text-gray-400 truncate">{e.link}</div>
            </div>
            <button onClick={() => sil(e.id)} disabled={silinenId === e.id}
              className="text-[11px] text-danger hover:underline shrink-0 ml-3 disabled:opacity-50">
              {silinenId === e.id ? "Siliniyor..." : "Sil"}
            </button>
          </div>
        ))}
        {egitimler.length === 0 && <div className="text-xs text-gray-400 py-3 text-center">Henüz eğitim linki eklenmedi.</div>}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input value={baslik} onChange={(e) => setBaslik(e.target.value)} placeholder="Eğitim başlığı (örn. İş Sağlığı ve Güvenliği)"
          className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..."
          className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
        <button onClick={ekle} disabled={pending || !baslik || !link}
          className="bg-navy hover:bg-navy-2 text-white rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 transition-colors shrink-0">
          {pending ? "Ekleniyor..." : "Ekle"}
        </button>
      </div>
      {error && <div className="text-xs text-danger mt-2">{error}</div>}
    </div>
  );
}
