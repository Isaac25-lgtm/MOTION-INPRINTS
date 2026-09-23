/**
 * Technologies-site configuration. Components must read URLs from here,
 * never from hardcoded production domains.
 *
 * Production values are unconfirmed. Development defaults are local only.
 */
export const site = {
  name: "Motion Imprints Technologies",
  shortName: "Technologies",
  parentName: "Motion Imprints",
  relationship: "A technology division of Motion Imprints",
  description:
    "Motion Imprints Technologies designs and builds health, M&E, business, SACCO, school and retail systems, websites, digital marketing and analytics: systems built around real work.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001",
  parentUrl: process.env.NEXT_PUBLIC_PARENT_URL ?? "http://localhost:3000",
} as const;

export type TechnologiesSiteConfig = typeof site;

/** Search engines stay out until ALLOW_INDEXING=true and the URL is public https. */
export const indexingAllowed =
  process.env.ALLOW_INDEXING === "true" &&
  /^https:\/\//.test(site.url) &&
  !/localhost/.test(site.url);
