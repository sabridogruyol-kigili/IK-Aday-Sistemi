"use server";

import { createClient } from "@/lib/supabase/server";
import { ARAC_TANIMLARI, aracCalistir } from "@/lib/aiAsistan/araclar";

export type SohbetMesaji = { rol: "user" | "assistant"; icerik: string };

const ROL_ACIKLAMA: Record<string, string> = {
  BM: "Bölge/Mağaza Müdürü — sadece kendi mağazasının/bölgesinin verilerini görebilir.",
  IK: "İnsan Kaynakları — sorumlu olduğu bölgelerin verilerini ve evrak süreçlerini görebilir.",
  YONETIM: "Yönetim — tüm verileri görebilir.",
  MAGAZALAR_DIREKTORLUGU: "Mağazalar Direktörlüğü — performans ve norm verilerini geniş kapsamda görebilir, aday/evrak süreçlerine erişimi yok.",
  BORDRO: "Bordro ve Çalışma İlişkileri — sadece evrak/bordro sürecini görebilir, performans ve aday verilerine erişimi yok.",
};

export async function aiSoruSor(gecmis: SohbetMesaji[]): Promise<{ cevap?: string; hata?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { hata: "Giriş yapmalısınız." };

  const { data: me } = await supabase.from("kullanicilar").select("ad_soyad, rol").eq("email", user.email).single();
  if (!me) return { hata: "Kullanıcı bulunamadı." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      hata: "AI Asistanı henüz aktif değil. Kullanmak için Vercel'de ANTHROPIC_API_KEY ortam değişkenini ekleyip yeniden deploy edin.",
    };
  }

  const sistemMesaji = `Senin adın "Kiğılı İK Asistanı" — Kiğılı İnsan Kaynakları Aday ve Süreç Takip Sistemi'nin yapay zeka asistanısın.

ÜSLUP:
Deneyimli, saygılı bir raporlama uzmanıyla konuşuyormuş gibi bir üslup kullan. Her zaman "siz" diye hitap et, hiçbir zaman "sen" deme. Konuşmanın doğal bir yerinde, ismini bildiğin kişiye uygun şekilde "Beyefendi" ya da "Hanımefendi" diye hitap et (isminden makul şekilde çıkarım yap; emin olamadığın durumlarda hitabı hiç kullanmadan da nazik ve saygılı bir üslupla devam edebilirsin).

Cevaplarını MADDE MADDE, numaralı liste ya da "•" işaretli liste şeklinde YAZMA — bunun yerine, bir uzmanın sözlü olarak rapor sunması gibi, akıcı ve doğal cümlelerle anlat. Örneğin sayısal bir sıralama sorulduğunda "En düşük performans gösteren üç kişi şöyle: Ayşe Yılmaz yüzde 42 ile en düşük, onu yüzde 48 ile Mehmet Demir izliyor, üçüncü sırada ise yüzde 51 ile Ali Kaya var" gibi cümleler kur — bunu "1. Ayşe Yılmaz — %42\\n2. Mehmet Demir — %48" şeklinde liste yapma.

Kısa değil, doyurucu ama gereksiz uzatmayan cevaplar ver — bir yöneticiye brifing verir gibi, önemli noktaları öne çıkar, gerekirse kısa bir yorum ya da öneri de ekle.

Şu anki kullanıcı: ${me.ad_soyad} — Rol: ${me.rol} (${ROL_ACIKLAMA[me.rol] ?? ""})

ÇOK ÖNEMLİ — VERİ DÜRÜSTLÜĞÜ: Sadece sana verilen araçları çağırarak elde ettiğin GERÇEK verilerle cevap ver. Asla veri uydurma. Bir araç "yetkiniz yok" ya da boş sonuç dönerse, bunu kullanıcıya nazikçe söyle — kendi bilginle doldurmaya çalışma. Araçlar zaten kullanıcının rolüne göre otomatik kısıtlanmıştır, sonuçlara güvenebilirsin.

Bir kişinin geçmiş istihdam dönemlerini (hangi mağazada ne zaman çalıştığı, ayrılıp tekrar döndüğü gibi) anlatırken sadece mağaza ve tarih bilgisini kullan — sistemde geçmiş dönemler için ayrı ayrı ünvan bilgisi tutulmuyor, sadece kişinin ŞU ANKİ ünvanı bilinir. Geçmiş bir dönem için ünvan uydurma; "o dönemde hangi ünvanla çalıştığı kayıtlı değil" diyebilirsin.`;

  const mesajlar: any[] = gecmis.map((m) => ({ role: m.rol, content: m.icerik }));

  try {
    for (let tur = 0; tur < 5; tur++) {
      const yanit = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: sistemMesaji,
          tools: ARAC_TANIMLARI,
          messages: mesajlar,
        }),
      });

      if (!yanit.ok) {
        const hataMetni = await yanit.text();
        return { hata: `AI servisi hatası (${yanit.status}): ${hataMetni.slice(0, 200)}` };
      }

      const veri = await yanit.json();
      const icerikBloklari = veri.content ?? [];
      const aracCagrilari = icerikBloklari.filter((b: any) => b.type === "tool_use");

      if (aracCagrilari.length === 0) {
        const metin = icerikBloklari.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
        return { cevap: metin || "Bir cevap üretemedim." };
      }

      // Asistanın araç çağrısını ve sonuçlarını konuşma geçmişine ekleyip devam ediyoruz.
      mesajlar.push({ role: "assistant", content: icerikBloklari });

      const aracSonuclari = await Promise.all(
        aracCagrilari.map(async (cagri: any) => {
          const sonuc = await aracCalistir(cagri.name, cagri.input);
          return {
            type: "tool_result",
            tool_use_id: cagri.id,
            content: JSON.stringify(sonuc.basarili ? sonuc.veri : { hata: sonuc.hata }),
          };
        })
      );
      mesajlar.push({ role: "user", content: aracSonuclari });
    }

    return { hata: "Çok fazla araç çağrısı yapıldı, lütfen soruyu sadeleştirin." };
  } catch (e: any) {
    return { hata: "Bağlantı hatası: " + (e?.message ?? "bilinmeyen hata") };
  }
}
