// E-postalara gömülecek mutlak bağlantılar için taban URL. Özel bir alan
// adınız varsa Vercel'de NEXT_PUBLIC_APP_URL ortam değişkenini ekleyin
// (örn. "https://ik.kigili.com.tr"); eklemezseniz Vercel'in kendi otomatik
// verdiği VERCEL_URL değişkeni kullanılır, ek bir ayara gerek kalmaz.
export function uygulamaUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
