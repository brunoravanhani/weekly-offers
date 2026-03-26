"use client";

import { useEffect, useMemo, useState } from "react";

type CatalogFile = {
  sourceKey: string;
  jsonKey: string;
  itemCount: number;
  updatedAt: string;
};

type CatalogIndex = {
  updatedAt: string;
  files: CatalogFile[];
};

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
  const [catalog, setCatalog] = useState<CatalogIndex | null>(null);
  const [selectedJsonKey, setSelectedJsonKey] = useState<string>("");
  const [offersFile, setOffersFile] = useState<OffersFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadCatalog() {
      try {
        setLoading(true);
        setError("");

        const catalogUrl = process.env.NEXT_PUBLIC_CATALOG_INDEX_URL || `${process.env.NEXT_PUBLIC_PROCESSED_BUCKET_URL}/data/catalog/index.json`;
        const response = await fetch(catalogUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Could not load catalog index: ${response.status}`);
        }

        const parsed: CatalogIndex = await response.json();
        setCatalog(parsed);

        if (parsed.files.length > 0) {
          setSelectedJsonKey(parsed.files[0].jsonKey);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, []);

  useEffect(() => {
    async function loadOffersFile() {
      if (!selectedJsonKey) {
        setOffersFile(null);
        return;
      }

      try {
        const bucketUrl = process.env.NEXT_PUBLIC_PROCESSED_BUCKET_URL || "";
        const offersUrl = bucketUrl ? `${bucketUrl}/${selectedJsonKey}` : `/${selectedJsonKey}`;
        const response = await fetch(offersUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Could not load offers file: ${response.status}`);
        }

        const parsed: OffersFile = await response.json();
        setOffersFile(parsed);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unknown error");
      }
    }

    loadOffersFile();
  }, [selectedJsonKey]);

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

      {!loading && !error && catalog && (
        <>
          <section className="toolbar">
            <label htmlFor="catalogFile">Select processed file</label>
            <select
              id="catalogFile"
              value={selectedJsonKey}
              onChange={(event) => setSelectedJsonKey(event.target.value)}
            >
              {catalog.files.map((file) => (
                <option key={file.jsonKey} value={file.jsonKey}>
                  {file.sourceKey} ({file.itemCount} items)
                </option>
              ))}
            </select>
          </section>

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
        </>
      )}
    </main>
  );
}
