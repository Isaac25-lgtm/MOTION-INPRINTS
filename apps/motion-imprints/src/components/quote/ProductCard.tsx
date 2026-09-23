import Link from "next/link";
import { Picture } from "@/components/media/Picture";
import { categoryInfo, type Product } from "@/content/catalogue";

/** Catalogue card. Price is always "on quotation": none is invented. */
export function ProductCard({
  product,
  sizes,
}: {
  product: Product;
  sizes: string;
}) {
  return (
    <Link className="product-card" href={`/products/${product.slug}`}>
      <div className="product-card__frame">
        <Picture frame={product.image} sizes={sizes} />
      </div>
      <span className="product-card__cat">
        {categoryInfo(product.category).label}
      </span>
      <span className="product-card__title">{product.title}</span>
      <span className="product-card__summary">{product.summary}</span>
      <span className="product-card__price">Priced on quotation</span>
    </Link>
  );
}
