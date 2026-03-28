import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Achadinhos do Papai",
  description: "Melhores ofertas de pai para pai"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
