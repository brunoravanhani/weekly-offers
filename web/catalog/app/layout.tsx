import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Achadinhos do Papai",
    template: "%s | Achadinhos do Papai"
  },
  description:
    "Catálogo atualizado de ofertas com preço em reais para comparar produtos e abrir promoções rapidamente.",
  keywords: [
    "ofertas",
    "promoções",
    "achadinhos",
    "catálogo de ofertas",
    "descontos"
  ],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Achadinhos do Papai",
    title: "Achadinhos do Papai",
    description:
      "Veja as melhores promoções em um catálogo simples, com busca por produto e loja.",
    images: [
      {
        url: "https://placehold.co/1200x630?text=Achadinhos+do+Papai",
        width: 1200,
        height: 630,
        alt: "Capa do catálogo Achadinhos do Papai"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Achadinhos do Papai",
    description:
      "Catálogo atualizado de promoções com busca por produto e loja.",
    images: ["https://placehold.co/1200x630?text=Achadinhos+do+Papai"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  }
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
