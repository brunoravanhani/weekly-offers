"use client";

import { useEffect, useMemo, useState } from "react";

type OfferItem = {
  itemId: string;
  itemName: string;
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

export default function Home() {
  const [offersFile, setOffersFile] = useState<OffersFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadOffers() {
      try {
        setLoading(true);
        setError("");

        const offersUrl = `${process.env.NEXT_PUBLIC_PROCESSED_BUCKET_URL}/data/processed/example.json`;
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

    return [...offersFile.items].sort((a, b) => {
      const priceA = a.price ?? 0;
      const priceB = b.price ?? 0;
      return priceA - priceB;
    });
  }, [offersFile]);

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Weekly Offers</p>
        <h1>CSV-powered deals catalog</h1>
        <p>
          Files uploaded to S3 are transformed by Lambda to JSON and rendered here from CloudFront.
        </p>
      </section>

      {loading && <p className="status">Loading catalog...</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && !error && offersFile && (
        <section className="grid">
          {sortedItems.map((item) => (
            <article key={item.itemId} className="card">
              <h2>{item.itemName}</h2>
              <p className="shop">{item.shopName}</p>
              <p className="price">{currency(item.price, item.priceRaw)}</p>
              <p className="meta">Sales: {item.sales}</p>
              <p className="meta">
                Commission: {currency(item.commission, item.commissionRaw)} ({item.commissionRateRaw})
              </p>
              <div className="links">
                <a href={item.productLink} target="_blank" rel="noreferrer">
                  Product
                </a>
                <a href={item.offerLink} target="_blank" rel="noreferrer">
                  Offer
                </a>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
