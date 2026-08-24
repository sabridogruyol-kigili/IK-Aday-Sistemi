import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "İK Aday ve Süreç Takip Sistemi",
  description: "Mağaza norm kadro, personel ve talep yönetim sistemi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="font-sans">{children}</body>
    </html>
  );
}
