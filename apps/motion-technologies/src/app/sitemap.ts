import type { MetadataRoute } from "next";
import { solutions } from "@/content/solutions";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/solutions",
    ...solutions.map((s) => `/solutions/${s.slug}`),
    "/capabilities/integrations",
    "/capabilities/security",
    "/work",
    "/about",
    "/contact",
    "/privacy",
  ];
  return paths.map((path) => ({
    url: `${site.url}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path.startsWith("/solutions/") ? 0.8 : 0.6,
  }));
}
