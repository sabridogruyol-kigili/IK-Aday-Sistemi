"use client";

import { useState, useTransition } from "react";
import { bedenOlculeriniKaydet, type BedenOlculeri } from "./actions-beden";

const CEKET_SECENEKLERI = ["44", "46", "48", "50", "52", "54", "56", "58", "60"];
const PANTOLON_SECENEKLERI = ["36", "38", "40", "42", "44", "46", "48", "50", "52", "54"];
const GOMLEK_SECENEKLERI = ["37", "38", "39", "40", "41", "42", "43", "44", "45"];
const TISORT_SECENEKLERI = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function BedenSecimi({ label, name, secenekler, deger, onChange }: {
  label: string; name: string; secenekler: string[]; deger: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">{label} *</label>
      <select
        name={name}
        required
        value={deger}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
      >
        <option value="">Seçin</option>
        {secenekler.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

export default function BedenOlculeriFormu({ mevcut }: { mevcut: BedenOlculeri | null }) {
  const [ceket, setCeket] = useState(mevcut?.beden_ceket ?? "");
  const [pantolon, setPantolon] = useState(mevcut?.beden_pantolon ?? "");
  const [gomlek, setGomlek] = useState(mevcut?.beden_gomlek ?? "");
  const [tisort, setTisort] = useState(mevcut?.beden_tisort ?? "");
  const [duzenleModu, setDuzenleModu] = useState(!(mevcut?.beden_ceket && mevcut?.beden_pantolon && mevcut?.beden_gomlek && mevcut?.beden_tisort));
  const [hata, setHata] = useState<string | null>(null);
  const [basarili, setBasarili] = useState(false);
  const [pending, startTransition] = useTransition();

  const tamamlanmisMi = !!(mevcut?.beden_ceket && mevcut?.beden_pantolon && mevcut?.beden_gomlek && mevcut?.beden_tisort);

  function kaydet(formData: FormData) {
    setHata(null);
    setBasarili(false);
    startTransition(async () => {
      const sonuc = await bedenOlculeriniKaydet(formData);
      if (sonuc?.error) { setHata(sonuc.error); return; }
      setBasarili(true);
      setDuzenleModu(false);
    });
  }

  if (!duzenleModu) {
    return (
      <div className="bg-white border border-gray-200 rounded-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide">Beden Ölçülerim</div>
          <button onClick={() => setDuzenleModu(true)} className="text-[11px] text-info hover:underline">Düzenle</button>
        </div>
        {basarili && <div className="text-[11px] text-success mb-2">Kaydedildi.</div>}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div><div className="text-[9px] text-gray-400">Ceket</div><div className="text-sm font-mono font-semibold text-navy-3">{ceket}</div></div>
          <div><div className="text-[9px] text-gray-400">Pantolon</div><div className="text-sm font-mono font-semibold text-navy-3">{pantolon}</div></div>
          <div><div className="text-[9px] text-gray-400">Gömlek</div><div className="text-sm font-mono font-semibold text-navy-3">{gomlek}</div></div>
          <div><div className="text-[9px] text-gray-400">Tişört</div><div className="text-sm font-mono font-semibold text-navy-3">{tisort}</div></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border rounded-card p-4 ${tamamlanmisMi ? "border-gray-200" : "border-danger/40"}`}>
      <div className="mb-3">
        <div className="text-[10px] font-semibold text-navy-3 uppercase tracking-wide">Beden Ölçülerim</div>
        {!tamamlanmisMi && (
          <div className="text-[11px] text-danger mt-1">
            Kurumsal kıyafet bedenleriniz için bu bilgiler zorunludur — lütfen dördünü de doldurun.
          </div>
        )}
      </div>
      <form action={kaydet} className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <BedenSecimi label="Ceket" name="beden_ceket" secenekler={CEKET_SECENEKLERI} deger={ceket} onChange={setCeket} />
          <BedenSecimi label="Pantolon" name="beden_pantolon" secenekler={PANTOLON_SECENEKLERI} deger={pantolon} onChange={setPantolon} />
          <BedenSecimi label="Gömlek (Yaka)" name="beden_gomlek" secenekler={GOMLEK_SECENEKLERI} deger={gomlek} onChange={setGomlek} />
          <BedenSecimi label="Tişört" name="beden_tisort" secenekler={TISORT_SECENEKLERI} deger={tisort} onChange={setTisort} />
        </div>
        {hata && <div className="text-[11px] text-danger bg-danger-bg rounded-md px-2.5 py-1.5">{hata}</div>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={pending} className="bg-navy text-white rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-50">
            {pending ? "Kaydediliyor..." : "Kaydet"}
          </button>
          {tamamlanmisMi && (
            <button type="button" onClick={() => setDuzenleModu(false)} className="text-xs text-gray-400">Vazgeç</button>
          )}
        </div>
      </form>
    </div>
  );
}
