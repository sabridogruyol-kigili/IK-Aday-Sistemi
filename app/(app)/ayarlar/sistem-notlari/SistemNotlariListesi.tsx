"use client";

import { useState } from "react";
import { getSistemNotlari, sistemNotuEkle, sistemNotuDurumDegistir, sistemNotuDuzenle, sistemNotuSil, type SistemNotu } from "./actions";

export default function SistemNotlariListesi({ ilkNotlar }: { ilkNotlar: SistemNotu[] }) {
  const [notlar, setNotlar] = useState<SistemNotu[]>(ilkNotlar);
  const [yeniMetin, setYeniMetin] = useState("");
  const [ekleniyor, setEkleniyor] = useState(false);
  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);
  const [duzenlemeMetni, setDuzenlemeMetni] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [sadeceBeklemede, setSadeceBeklemede] = useState(false);

  function yenile() {
    getSistemNotlari().then(setNotlar);
  }

  function ekle() {
    if (!yeniMetin.trim()) return;
    setEkleniyor(true);
    setHata(null);
    sistemNotuEkle(yeniMetin).then((res) => {
      setEkleniyor(false);
      if (res.error) { setHata(res.error); return; }
      setYeniMetin("");
      yenile();
    });
  }

  function durumDegistir(n: SistemNotu) {
    const yeniDurum = n.durum === "BEKLEMEDE" ? "TAMAMLANDI" : "BEKLEMEDE";
    setNotlar((liste) => liste.map((x) => (x.id === n.id ? { ...x, durum: yeniDurum } : x)));
    sistemNotuDurumDegistir(n.id, yeniDurum).then((res) => {
      if (res.error) { setHata(res.error); yenile(); }
    });
  }

  function duzenlemeyiKaydet(id: string) {
    if (!duzenlemeMetni.trim()) return;
    sistemNotuDuzenle(id, duzenlemeMetni).then((res) => {
      if (res.error) { setHata(res.error); return; }
      setDuzenlenenId(null);
      yenile();
    });
  }

  function sil(id: string) {
    if (!confirm("Bu notu silmek istediğinize emin misiniz?")) return;
    sistemNotuSil(id).then((res) => {
      if (res.error) { setHata(res.error); return; }
      yenile();
    });
  }

  const gosterilenler = sadeceBeklemede ? notlar.filter((n) => n.durum === "BEKLEMEDE") : notlar;
  const beklemedeSayisi = notlar.filter((n) => n.durum === "BEKLEMEDE").length;

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-card p-4 mb-4">
        <label className="block text-[10px] font-semibold text-navy-3 uppercase mb-1">Yeni Not</label>
        <textarea
          value={yeniMetin}
          onChange={(e) => setYeniMetin(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ekle(); }}
          placeholder="Bir not/hatırlatma/yapılacak yazın... (Ctrl+Enter ile ekle)"
          rows={2}
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-navy resize-none"
        />
        {hata && <div className="text-[11px] text-danger mt-1.5">{hata}</div>}
        <button onClick={ekle} disabled={ekleniyor || !yeniMetin.trim()}
          className="mt-2 bg-navy hover:bg-navy-2 text-white rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-colors">
          {ekleniyor ? "Ekleniyor..." : "Not Ekle"}
        </button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-gray-400">{beklemedeSayisi} beklemede / {notlar.length} toplam</div>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
          <input type="checkbox" checked={sadeceBeklemede} onChange={(e) => setSadeceBeklemede(e.target.checked)} />
          Sadece beklemede olanlar
        </label>
      </div>

      <div className="space-y-2">
        {gosterilenler.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-8 bg-white border border-gray-200 rounded-card">
            {sadeceBeklemede ? "Bekleyen not yok." : "Henüz not eklenmemiş."}
          </div>
        )}
        {gosterilenler.map((n) => (
          <div key={n.id} className={`bg-white border rounded-card p-3 ${n.durum === "TAMAMLANDI" ? "border-success/20 bg-success-bg/10" : "border-gray-200"}`}>
            <div className="flex items-start gap-2.5">
              <button
                onClick={() => durumDegistir(n)}
                title={n.durum === "BEKLEMEDE" ? "Tamamlandı olarak işaretle" : "Beklemede olarak işaretle"}
                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                  n.durum === "TAMAMLANDI" ? "bg-success border-success text-white" : "border-gray-300 hover:border-navy"
                }`}
              >
                {n.durum === "TAMAMLANDI" && "✓"}
              </button>

              <div className="flex-1 min-w-0">
                {duzenlenenId === n.id ? (
                  <div>
                    <textarea
                      value={duzenlemeMetni}
                      onChange={(e) => setDuzenlemeMetni(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-navy resize-none"
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button onClick={() => duzenlemeyiKaydet(n.id)} className="text-[11px] font-medium bg-navy text-white rounded-md px-2.5 py-1">Kaydet</button>
                      <button onClick={() => setDuzenlenenId(null)} className="text-[11px] text-gray-400">Vazgeç</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`text-sm whitespace-pre-wrap ${n.durum === "TAMAMLANDI" ? "text-gray-400 line-through" : "text-navy-3"}`}>
                      {n.metin}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {n.olusturan_ad_soyad} · {new Date(n.created_at).toLocaleDateString("tr-TR")}
                      {n.guncelleyen_ad_soyad && n.guncelleyen_ad_soyad !== n.olusturan_ad_soyad && ` · son düzenleyen: ${n.guncelleyen_ad_soyad}`}
                    </div>
                  </>
                )}
              </div>

              {duzenlenenId !== n.id && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => { setDuzenlenenId(n.id); setDuzenlemeMetni(n.metin); }}
                    className="text-[10px] font-medium bg-white border border-info/40 text-info hover:bg-info/5 rounded-md px-1.5 py-0.5 transition-colors"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => sil(n.id)}
                    className="text-[10px] font-medium bg-white border border-danger/30 text-danger hover:bg-danger-bg rounded-md px-1.5 py-0.5 transition-colors"
                  >
                    Sil
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
