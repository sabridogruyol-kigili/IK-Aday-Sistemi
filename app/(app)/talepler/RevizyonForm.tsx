"use client";

import { useState, useTransition } from "react";
import { revizeGonder } from "./actions";

export default function RevizyonForm({ talepId }: { talepId: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [aciklama, setAciklama] = useState("");
  const [error, setError] = useState<string | null>(null);

  function gonder() {
    setError(null);
    const fd = new FormData();
    fd.set("talep_id", talepId);
    fd.set("aciklama", aciklama);
    startTransition(async () => {
      const res = await revizeGonder(fd);
      if (res?.error) setError(res.error);
      else setOpen(false);
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-info underline">
        Açıklama ile tekrar gönder
      </button>
    );
  }

  return (
    <div className="space-y-2 mt-1">
      <textarea
        value={aciklama}
        onChange={(e) => setAciklama(e.target.value)}
        placeholder="Neden ısrar ediyorsunuz? (zorunlu)"
        rows={2}
        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
      />
      <div className="flex gap-2">
        <button onClick={gonder} disabled={pending || !aciklama.trim()}
          className="bg-navy text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
          {pending ? "Gönderiliyor..." : "Tekrar Gönder"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-400">Vazgeç</button>
      </div>
      {error && <div className="text-xs text-danger">{error}</div>}
    </div>
  );
}
