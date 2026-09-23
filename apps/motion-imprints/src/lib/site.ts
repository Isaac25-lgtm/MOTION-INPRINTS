/**
 * Parent-site configuration. Components must read URLs from here,
 * never from hardcoded production domains.
 *
 * Production values are unconfirmed. Development defaults are local only.
 */
export const site = {
  name: "Motion Imprints",
  shortName: "Motion",
  tagline: "Design • Print • Brand",
  description:
    "Motion Imprints is a creative and production company covering design, printing, branding, signage, packaging and corporate merchandise.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  technologiesUrl:
    process.env.NEXT_PUBLIC_TECHNOLOGIES_URL ?? "http://localhost:3001",
  technologiesName: "Motion Imprints Technologies",
} as const;

export type ParentSiteConfig = typeof site;

/**
 * Whether search engines may index the site. Off unless the launch is
 * deliberate: ALLOW_INDEXING=true and a public https site URL.
 */
export const indexingAllowed =
  process.env.ALLOW_INDEXING === "true" &&
  /^https:\/\//.test(site.url) &&
  !/localhost/.test(site.url);
