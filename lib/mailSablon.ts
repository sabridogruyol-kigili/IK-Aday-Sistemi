// Aday/personele giden e-postalarda kullanılan, markaya uygun (lacivert,
// IBM Plex) ortak HTML iskeleti — hem "işe alım onaylandı" hem "hatırlatma"
// mailleri bunu kullanır, tek yerden yönetilir.

export function mailIskelet(opts: {
  baslik: string;
  govdeHtml: string; // <p> etiketleriyle hazır gövde metni
  butonMetni?: string;
  butonLink?: string;
}): string {
  const buton = opts.butonLink && opts.butonMetni ? `
    <div style="text-align: center; margin: 28px 0 8px;">
      <a href="${opts.butonLink}" style="display: inline-block; background-color: #0F1B4D; color: #ffffff; text-decoration: none; font-family: 'IBM Plex Sans', Arial, sans-serif; font-size: 14px; font-weight: 600; padding: 13px 28px; border-radius: 6px;">
        ${opts.butonMetni}
      </a>
    </div>
  ` : "";

  return `
<div style="font-family: 'IBM Plex Sans', -apple-system, 'Segoe UI', Arial, sans-serif; background-color: #FAFAF8; padding: 40px 20px;">
  <div style="max-width: 460px; margin: 0 auto; background: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #e5e5e0;">

    <div style="background-color: #0F1B4D; padding: 24px 28px;">
      <div style="color: #ffffff; font-size: 15px; font-weight: 600; line-height: 1.4;">
        İnsan Kaynakları<br />Aday ve Süreç Takip Sistemi
      </div>
    </div>

    <div style="padding: 32px 28px;">
      <div style="color: #1C2430; font-size: 17px; font-weight: 600; margin-bottom: 16px;">
        ${opts.baslik}
      </div>

      <div style="color: #4A4E58; font-size: 13.5px; line-height: 1.7;">
        ${opts.govdeHtml}
      </div>

      ${buton}
    </div>

    <div style="background-color: #FAFAF8; padding: 14px 28px; text-align: center;">
      <div style="color: #b0b0ac; font-size: 10px;">
        Bu otomatik bir e-postadır, yanıtlamayınız.
      </div>
    </div>

  </div>
</div>`;
}

export function tarihTr(tarihStr: string | null): string {
  if (!tarihStr) return "—";
  const d = new Date(tarihStr + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
}

// Evrak teslim son tarihi: işe başlama tarihinden 1 gün önce, saat 12:00.
export function evrakSonTarih(iseBaslamaTarihi: string | null): string {
  if (!iseBaslamaTarihi) return "en kısa sürede";
  const baslama = new Date(iseBaslamaTarihi + "T00:00:00");
  if (isNaN(baslama.getTime())) return "en kısa sürede";
  const sonTarih = new Date(baslama);
  sonTarih.setDate(sonTarih.getDate() - 1);
  const tarihMetni = sonTarih.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  return `${tarihMetni} Saat 12:00'ye kadar`;
}
