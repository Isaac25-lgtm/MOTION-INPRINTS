import type { MetadataRoute } from "next";
import { indexingAllowed, site } from "@/lib/site";

/**
 * Search engines are kept out until launch is deliberate: indexing needs
 * ALLOW_INDEXING=true and a public https NEXT_PUBLIC_SITE_URL at build time.
 * `npm run launch:check` lists this with the other launch steps.
 */
export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/quote"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
