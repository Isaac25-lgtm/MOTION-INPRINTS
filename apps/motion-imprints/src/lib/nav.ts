import { site } from "./site";

export type NavItem = {
  href: string;
  label: string;
  external: boolean;
};

export const primaryNav: NavItem[] = [
  { href: "/work", label: "Work", external: false },
  { href: "/services", label: "Services", external: false },
  { href: "/products", label: "Products", external: false },
  { href: "/about", label: "About", external: false },
  { href: "/contact", label: "Contact", external: false },
  {
    href: site.technologiesUrl,
    label: "Technologies",
    external: true,
  },
];

export const services = [
  {
    slug: "design",
    title: "Design",
    summary: "Logos, layouts and artwork prepared for production.",
  },
  {
    slug: "printing",
    title: "Printing",
    summary:
      "Stationery, marketing print and large-format, finished and ready to use.",
  },
  {
    slug: "branding",
    title: "Branding",
    summary:
      "One identity applied across stationery, uniforms, spaces and items.",
  },
  {
    slug: "signage",
    title: "Signage & Banners",
    summary:
      "Fascias, illuminated signs, letters, wayfinding and event banners.",
  },
  {
    slug: "packaging",
    title: "Packaging",
    summary: "Labels, boxes and bags for products and shops.",
  },
  {
    slug: "corporate",
    title: "Corporate & Promotional",
    summary: "Branded apparel, drinkware, office items and gifts.",
  },
] as const;

export type ServiceSlug = (typeof services)[number]["slug"];

export function getService(slug: string) {
  return services.find((item) => item.slug === slug) ?? null;
}
