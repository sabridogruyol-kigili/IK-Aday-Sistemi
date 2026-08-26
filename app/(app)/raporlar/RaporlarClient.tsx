"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const RENKLER = ["#1e3a5f", "#4a90d9", "#7cb9e8", "#a8d0f0", "#d4e8fa"];
const DURUM_RENK: Record<string, string> = {
  "Beklemede": "#f5a623",
  "Kabul Edildi": "#4caf50",
  "Duraklamış": "#e74c3c",
  "Kapandı (Red)": "#95a5a6",
  "İşlemde": "#4a90d9",
};
const HGO_RENK: Record<string, string> = {
  "%80 altı": "#e74c3c",
  "%80–100": "#f5a623",
  "%100 üstü": "#4caf50",
};

function Kart({ baslik, children, altYazi }: { baslik: string; children: React.ReactNode; altYazi?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-card p-4">
      <div className="text-xs font-semibold text-navy-3 mb-3">{baslik}</div>
      {children}
      {altYazi && <div className="text-[10px] text-gray-400 mt-2">{altYazi}</div>}
    </div>
  );
}

export default function RaporlarClient({
  normDolulukVerisi,
  talepDurumVerisi,
  talepTuruVerisi,
  hgoDagilimi,
  kadroKategorisiVerisi,
  hgoTrendVerisi,
  performansVeriSayisi,
}: {
  normDolulukVerisi: { bolge: string; dolu: number; norm: number }[];
  talepDurumVerisi: { durum: string; adet: number }[];
  talepTuruVerisi: { tur: string; adet: number }[];
  hgoDagilimi: { kategori: string; adet: number }[];
  kadroKategorisiVerisi: { kategori: string; adet: number }[];
  hgoTrendVerisi: { ay: string; ortalamaHgo: number }[];
  performansVeriSayisi: number;
}) {
  const hicVeriYok = normDolulukVerisi.length === 0 && talepDurumVerisi.length === 0;

  if (hicVeriYok) {
    return (
      <div className="bg-white border border-gray-200 rounded-card p-8 text-center text-gray-400 text-xs">
        Gösterilecek veri bulunamadı. Norm ve Personel import'ları tamamlandıkça grafikler otomatik dolacak.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Kart baslik="Bölge Bazlı Norm Doluluk (Dolu / Norm)" altYazi="Kırmızı çizgiye yakın/üstü sütunlar norm aşımını gösterir">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={normDolulukVerisi}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="bolge" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="norm" name="Norm" fill="#a8d0f0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="dolu" name="Dolu" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Kart>

      <Kart baslik="Talep Durum Dağılımı">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={talepDurumVerisi} dataKey="adet" nameKey="durum" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 10 }}>
              {talepDurumVerisi.map((d, i) => (
                <Cell key={i} fill={DURUM_RENK[d.durum] ?? RENKLER[i % RENKLER.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </Kart>

      <Kart baslik="Talep Türü Dağılımı">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={talepTuruVerisi} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis dataKey="tur" type="category" tick={{ fontSize: 11 }} width={90} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="adet" name="Adet" fill="#4a90d9" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Kart>

      <Kart baslik="Kadro Kategorisi Dağılımı (Aktif Personel)">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={kadroKategorisiVerisi} dataKey="adet" nameKey="kategori" cx="50%" cy="50%" outerRadius={80} label={{ fontSize: 10 }}>
              {kadroKategorisiVerisi.map((d, i) => (
                <Cell key={i} fill={RENKLER[i % RENKLER.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </Kart>

      <Kart
        baslik="Kişi Bazlı Performans (Ortalama HGO) Dağılımı"
        altYazi={performansVeriSayisi === 0 ? "Henüz performans verisi içe aktarılmadı." : `${performansVeriSayisi} personel için hesaplandı.`}
      >
        {performansVeriSayisi === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-[11px] text-gray-400">Veri yok</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hgoDagilimi}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="kategori" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="adet" name="Kişi Sayısı" radius={[4, 4, 0, 0]}>
                {hgoDagilimi.map((d, i) => (
                  <Cell key={i} fill={HGO_RENK[d.kategori] ?? RENKLER[i % RENKLER.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Kart>

      <Kart baslik="Aylık Ortalama Mağaza HGO Trendi" altYazi="Tüm mağazaların Performans importundaki 'Total' satırlarının ay bazlı ortalaması">
        {hgoTrendVerisi.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-[11px] text-gray-400">Veri yok</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hgoTrendVerisi}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="ay" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="ortalamaHgo" name="Ort. HGO (%)" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Kart>
    </div>
  );
}
