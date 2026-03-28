"use client";

import { useEffect, useMemo, useState } from "react";

type OfferItem = {
  itemId: string;
  itemName: string;
  createdAt?: string;
  image?: string | null;
  price: number | null;
  priceRaw: string;
  sales: string;
  shopName: string;
  commissionRate: number | null;
  commissionRateRaw: string;
  commission: number | null;
  commissionRaw: string;
  productLink: string;
  offerLink: string;
};

type OffersFile = {
  source: {
    bucket: string;
    key: string;
  };
  generatedAt: string;
  itemCount: number;
  items: OfferItem[];
};

function currency(value: number | null, fallback: string) {
  if (value === null) return fallback;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function teaserText(item: OfferItem) {
  const commission = currency(item.commission, item.commissionRaw);
  return `${item.shopName} com ${item.sales} vendas e comissão de ${commission}.`;
}

export default function Home() {
  const [offersFile, setOffersFile] = useState<OffersFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

  useEffect(() => {
    async function loadOffers() {
      try {
        setLoading(true);
        setError("");

        const offersUrl = `${process.env.NEXT_PUBLIC_PROCESSED_BUCKET_URL}/data/catalog/index.json`;
        const response = await fetch(offersUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Could not load offers: ${response.status}`);
        }

        const parsed: OffersFile = await response.json();
        setOffersFile(parsed);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadOffers();
  }, []);

  const sortedItems = useMemo(() => {
    if (!offersFile) return [];

    let filtered = [...offersFile.items];
    
    // Filter by search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.itemName.toLowerCase().includes(lowerQuery) ||
        item.shopName.toLowerCase().includes(lowerQuery)
      );
    }

    // Sort by newest first
    return filtered.sort((a, b) => {
      const createdAtA = a.createdAt ? Date.parse(a.createdAt) : 0;
      const createdAtB = b.createdAt ? Date.parse(b.createdAt) : 0;

      if (createdAtA !== createdAtB) {
        return createdAtB - createdAtA;
      }

      // Keep deterministic ordering when timestamps match or are missing.
      return (a.itemName || "").localeCompare(b.itemName || "", "pt-BR");
    });
  }, [offersFile, searchQuery]);

  const structuredData = useMemo(() => {
    const itemListElement = sortedItems.slice(0, 20).map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: item.itemName,
        image: item.image || undefined,
        brand: {
          "@type": "Brand",
          name: item.shopName
        },
        offers: {
          "@type": "Offer",
          priceCurrency: "BRL",
          price: item.price ?? undefined,
          url: item.offerLink,
          seller: {
            "@type": "Organization",
            name: item.shopName
          }
        }
      }
    }));

    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          name: "Achadinhos do Papai",
          url: siteUrl,
          inLanguage: "pt-BR"
        },
        {
          "@type": "ItemList",
          name: "Lista de ofertas",
          numberOfItems: sortedItems.length,
          itemListElement
        }
      ]
    };
  }, [siteUrl, sortedItems]);

  return (
    <main className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className="shell-header">
        <div className="brand-row">
          <h1 className="brand">Achadinhos do Papai</h1>
          <div className="header-actions" aria-hidden="true">
            {/* <span className="icon-btn">+</span>
            <span className="icon-btn">◉</span> */}
          </div>
        </div>
        <nav className="tabs" aria-label="Sections">
          {/* <a href="#" className="tab active">
            Promoções <span className="badge">10</span>
          </a> */}
          
        </nav>
        <p className="status">
          Catálogo de promoções com busca por nome do produto e loja.
        </p>
      </header>

      <div className="content">
        <section className="search-row">
          <input 
            type="text" 
            placeholder="Pesquisar em Promoções" 
            aria-label="Pesquisar em promoções"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <button 
            type="button"
            onClick={() => setSearchQuery("")}
          >
            Buscar
          </button>
        </section>

        {loading && <p className="status">Loading catalog...</p>}
        {error && <p className="status error">{error}</p>}

        {!loading && !error && offersFile && (
          <>
            {searchQuery && (
              <p className="status">
                Encontrados {sortedItems.length} produto{sortedItems.length !== 1 ? 's' : ''} para "{searchQuery}"
              </p>
            )}
            <section className="feed">
            {sortedItems.map((item, index) => (
              <article key={item.itemId} className="offer-card">
                <img
                  className="product-image"
                  src={item.image || "https://placehold.co/120x120?text=Sem+imagem"}
                  alt={item.itemName}
                  loading="lazy"
                />
                <div className="offer-body">
                  <h2>{item.itemName}</h2>
                  <p className="price">{currency(item.price, item.priceRaw)}</p>
                  {/* <p className="summary">{teaserText(item)}</p> */}
                  <div className="links">
                    <a
                      href={item.offerLink}
                      target="_blank"
                      rel="noopener noreferrer nofollow sponsored"
                      aria-label={`Abrir oferta de ${item.itemName}. ${teaserText(item)}`}
                    >
                      Ir para oferta
                    </a>
                  </div>
                </div>
              </article>
            ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
