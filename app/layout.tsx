import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "İK Aday ve Süreç Takip Sistemi",
  description: "İK Aday ve Süreç Takip Sistemi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
