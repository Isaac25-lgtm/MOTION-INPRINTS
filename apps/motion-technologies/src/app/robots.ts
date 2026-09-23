import type { MetadataRoute } from "next";
import { indexingAllowed, site } from "@/lib/site";

/** Search engines stay out until the launch is deliberate (ALLOW_INDEXING). */
export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/contact/sent"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
