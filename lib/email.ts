import nodemailer from "nodemailer";

// Microsoft 365 SMTP bilgileri ortam değişkenlerinden okunur.
// .env.local / Vercel ortam değişkenlerine eklenmesi gereken anahtarlar:
//   SMTP_HOST     -> smtp.office365.com
//   SMTP_PORT     -> 587
//   SMTP_USER     -> gönderen kurumsal e-posta adresi (örn. ik@sirket.com)
//   SMTP_PASS     -> uygulama şifresi / hesap şifresi
//   SMTP_FROM     -> "İK Sistemi <ik@sirket.com>" formatında görünen ad

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP ortam değişkenleri eksik (SMTP_HOST, SMTP_USER, SMTP_PASS).");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 587 için false (STARTTLS), 465 için true
    auth: { user, pass },
  });

  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }) {
  try {
    const t = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await t.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { error: null };
  } catch (err: any) {
    // Mail gönderimi başarısız olsa bile ana iş akışını (onay/işe alım) durdurmamak için
    // hatayı fırlatmıyoruz, sadece logluyoruz ve çağıran tarafa bildiriyoruz.
    console.error("Mail gönderilemedi:", err?.message ?? err);
    return { error: err?.message ?? "Mail gönderilemedi." };
  }
}
