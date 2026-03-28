"use client";

import { useEffect, useMemo, useState } from "react";

type OfferItem = {
  itemId: string;
  itemName: string;
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

    // Sort by price
    return filtered.sort((a, b) => {
      const priceA = a.price ?? 0;
      const priceB = b.price ?? 0;
      return priceA - priceB;
    });
  }, [offersFile, searchQuery]);

  return (
    <main className="page">
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
                    <a href={item.offerLink} target="_blank" rel="noreferrer">
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
