import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Picture } from "@/components/media/Picture";
import { AddToQuote } from "@/components/quote/AddToQuote";
import { ProductCard } from "@/components/quote/ProductCard";
import {
  categoryInfo,
  getProduct,
  products,
  relatedProducts,
} from "@/content/catalogue";
import { contact, whatsappHref } from "@/lib/contact";
import { getService } from "@/lib/nav";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return {
    title: product.title,
    description: `${product.summary} Priced on quotation.`,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${product.title} — Motion Imprints`,
      description: product.summary,
      images: [
        {
          url: `${product.image.base}-${product.image.widths[0]}.webp`,
          width: product.image.width,
          height: product.image.height,
          alt: product.image.alt,
        },
      ],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const category = categoryInfo(product.category);
  const service = getService(product.service);
  const related = relatedProducts(product);

  return (
    <>
      <div className="container product">
        <Breadcrumbs
          items={[
            { href: "/products", label: "Products" },
            {
              href: `/products?category=${product.category}`,
              label: category.label,
            },
            { label: product.title },
          ]}
        />
        <div className="product__grid">
          <figure className="product__media">
            <div className="product__frame">
              <Picture
                frame={product.image}
                sizes="(min-width: 901px) 48vw, 100vw"
                priority
              />
            </div>
            <figcaption>
              Pictured: a piece from our archive. Yours is made to your artwork.
            </figcaption>
          </figure>

          <div className="product__body">
            <p className="eyebrow">{category.label}</p>
            <h1 className="display product__title">{product.title}</h1>
            <p className="lede">{product.summary}</p>
            <p className="product__price">
              <strong>Priced on quotation.</strong> The price depends on
              quantity, options and artwork; we confirm it when we reply.
            </p>

            <AddToQuote
              slug={product.slug}
              title={product.title}
              unit={product.unit}
              options={product.options}
              notesHint={`Useful to include: ${product.specify.join("; ").toLowerCase()}.`}
            />

            <div className="product__alt">
              <p>Prefer to talk it through?</p>
              <ul>
                <li>
                  <Link
                    className="textlink"
                    href={`/contact?product=${product.slug}`}
                  >
                    Send a message <span aria-hidden="true">→</span>
                  </Link>
                </li>
                {contact.whatsapp ? (
                  <li>
                    <a
                      className="textlink"
                      href={whatsappHref(
                        contact.whatsapp,
                        `Hello Motion Imprints, I would like a quotation for ${product.title.toLowerCase()}.`,
                      )}
                    >
                      WhatsApp us <span aria-hidden="true">↗</span>
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <section className="product-facts" aria-label="Product details">
        <div className="container product-facts__grid">
          <div>
            <h2 className="eyebrow">Good for</h2>
            <ul>
              {product.goodFor.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="eyebrow">Tell us when you order</h2>
            <ul>
              {product.specify.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          {service ? (
            <div>
              <h2 className="eyebrow">Related service</h2>
              <Link
                className="product-facts__service"
                href={`/services/${service.slug}`}
              >
                <strong>{service.title}</strong>
                <span>{service.summary}</span>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {related.length ? (
        <section
          className="container related-products"
          aria-labelledby="related-title"
        >
          <h2 id="related-title" className="display">
            More in {category.label.toLowerCase()}
          </h2>
          <ul className="product-grid product-grid--three">
            {related.map((p) => (
              <li key={p.slug}>
                <ProductCard
                  product={p}
                  sizes="(min-width: 1025px) 30vw, (min-width: 701px) 31vw, 46vw"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
