import type { Metadata } from "next";
import { defaultOgImages } from "@/lib/og";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CtaBand } from "@/components/CtaBand";
import { ProductCard } from "@/components/quote/ProductCard";
import {
  categoryInfo,
  isProductCategory,
  productCategories,
  products,
} from "@/content/catalogue";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const description =
  "Business cards, banners, signs, branded apparel, promotional items and packaging from Motion Imprints. Choose your options and request a quotation.";

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { category } = await searchParams;
  const active = isProductCategory(category) ? category : null;
  return {
    title: active ? categoryInfo(active).label : "Products",
    description,
    alternates: { canonical: "/products" },
    openGraph: {
      title: "Products — Motion Imprints",
      description,
      images: defaultOgImages,
    },
  };
}

const steps = [
  "Choose a product and the options you know",
  "Add it to your quote list, with quantities",
  "Send the list with your contact details",
  "We reply with questions or a quotation",
];

export default async function ProductsPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const active = isProductCategory(category) ? category : null;
  const shown = active
    ? products.filter((p) => p.category === active)
    : products;
  const filters = [
    { id: null, label: "All", count: products.length },
    ...productCategories.map((c) => ({
      id: c.id,
      label: c.label,
      count: products.filter((p) => p.category === c.id).length,
    })),
  ];

  return (
    <>
      <header className="page-head container">
        <Breadcrumbs items={[{ label: "Products" }]} />
        <div className="page-head__grid">
          <h1 className="display page-head__title">Products</h1>
          <div>
            <p className="lede">
              Everything here is made to order and priced on quotation. Pick
              what you need, add it to a quote list and send it in one go.
            </p>
            <ol className="how-steps">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      </header>

      <section className="container work-index" aria-labelledby="list-title">
        <h2 id="list-title" className="visually-hidden">
          {active ? categoryInfo(active).label : "All products"}
        </h2>
        <nav className="work-filters" aria-label="Filter products by category">
          <ul>
            {filters.map((f) => (
              <li key={f.label}>
                <Link
                  href={f.id ? `/products?category=${f.id}` : "/products"}
                  aria-current={f.id === active ? "page" : undefined}
                  scroll={false}
                >
                  {f.label}{" "}
                  <span className="work-filters__count">{f.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="work-index__status" role="status">
          {active
            ? `${categoryInfo(active).intro} ${shown.length} products.`
            : `${shown.length} products`}
        </p>

        {shown.length ? (
          <ul className="product-grid">
            {shown.map((p) => (
              <li key={p.slug}>
                <ProductCard
                  product={p}
                  sizes="(min-width: 1025px) 23vw, (min-width: 701px) 31vw, 46vw"
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="work-empty">
            <p>No products in this category yet.</p>
            <Link className="textlink" href="/products">
              Show all products <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </section>

      <CtaBand
        title="Can't see what you need?"
        text="Most of what we make is custom. Describe it and we will tell you what is possible."
        label="Describe Your Project"
        secondary={{ href: "/services", label: "Browse Services" }}
      />
    </>
  );
}
