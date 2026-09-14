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
      <head>
        {/* Sayfa boyanmadan ÖNCE, kayıtlı tema tercihini uygular — aksi
            halde açık modda bir an görünüp sonra koyu moda geçme (flaş)
            olurdu. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var tema = localStorage.getItem('tema');
                if (tema === 'koyu') document.documentElement.classList.add('dark');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
