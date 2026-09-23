import type { MetadataRoute } from "next";
import { products } from "@/content/catalogue";
import { collections } from "@/content/work";
import { services } from "@/lib/nav";
import { site } from "@/lib/site";

/** Public, indexable pages. The quote list and API routes are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/services",
    ...services.map((s) => `/services/${s.slug}`),
    "/work",
    ...collections.map((c) => `/work/${c.slug}`),
    "/products",
    ...products.map((p) => `/products/${p.slug}`),
    "/about",
    "/contact",
    "/privacy",
  ];
  return paths.map((path) => ({
    url: `${site.url}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path.split("/").length === 2 ? 0.8 : 0.6,
  }));
}
