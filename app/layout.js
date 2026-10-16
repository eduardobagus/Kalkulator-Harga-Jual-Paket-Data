import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata = {
  title: "Kalkulator Harga Jual Paket Data",
  description:
    "Hitung harga jual minimal paket data berdasarkan target margin, COGS, dan volume penjualan. Mendukung impor massal dari Excel dan CSV.",
  keywords: ["kalkulator", "harga jual", "paket data", "margin", "COGS"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>{children}</body>
    </html>
  );
}
