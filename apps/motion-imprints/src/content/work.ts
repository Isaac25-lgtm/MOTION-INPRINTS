import type { Frame } from "@/components/media/Picture";
import type { ServiceSlug } from "@/lib/nav";
import media from "./work-media.json";
import { featured, workLead, workSupport } from "./homepage";

/**
 * Motion Imprints portfolio.
 *
 * Genuine photographs from the Motion archive only. Never add stock, mockups
 * or generated images here. Derivatives are built by
 * scripts/build-work-assets.py (and scripts/build-home-assets.py for the items
 * shared with the homepage).
 *
 * Labels describe what is visible. Motion's exact role in each job is not yet
 * confirmed by the owner, so no caption claims scope, outcome or date.
 *
 * permission:
 *   pending   publication permission not yet confirmed. Allowed in
 *             development; `npm run launch:check` lists every one of these
 *             and fails until each is approved or removed.
 *   approved  confirmed by the owner for public use.
 */

export type WorkCategory =
  "signage" | "interiors" | "print" | "merchandise" | "packaging" | "events";

export const workCategories: { id: WorkCategory; label: string }[] = [
  { id: "signage", label: "Signage" },
  { id: "interiors", label: "Interiors" },
  { id: "print", label: "Print" },
  { id: "merchandise", label: "Merchandise" },
  { id: "packaging", label: "Packaging" },
  { id: "events", label: "Events" },
];

export type Permission = "pending" | "approved";

export type WorkItem = {
  slug: string;
  title: string;
  category: WorkCategory;
  source: string;
  permission: Permission;
  collection?: CollectionSlug;
  frame: Frame;
};

type Built = {
  source: string;
  widths: number[];
  width: number;
  height: number;
};
const built = media as Record<string, Built>;

function item(
  slug: string,
  title: string,
  category: WorkCategory,
  alt: string,
  extra: { collection?: CollectionSlug; position?: string } = {},
): WorkItem {
  const m = built[slug];
  if (!m) throw new Error(`work media missing for ${slug}`);
  return {
    slug,
    title,
    category,
    source: m.source,
    permission: "pending",
    collection: extra.collection,
    frame: {
      base: `/media/work/${slug}`,
      widths: m.widths,
      width: m.width,
      height: m.height,
      alt,
      position: extra.position,
    },
  };
}

/** An item that already serves the homepage: same derivative, no copy. */
function shared(
  slug: string,
  title: string,
  category: WorkCategory,
  from: { source: string; frame: Frame },
): WorkItem {
  return {
    slug,
    title,
    category,
    source: from.source,
    permission: "pending",
    frame: from.frame,
  };
}

const [illuminated, interior] = workLead;
const [[halo, dimensional], [caps, gift]] = workSupport;

export const workItems: WorkItem[] = [
  // Signage
  shared("illuminated-letters", "Illuminated letters", "signage", illuminated),
  item(
    "illuminated-shop-sign",
    "Illuminated shop sign",
    "signage",
    "Illuminated sign with pink and blue Toys and Tales lettering above a printed contact panel.",
    { collection: "toys-and-tales" },
  ),
  item(
    "fascia-at-night",
    "Fascia at night",
    "signage",
    "Black apotek skin care store fascia with white lettering, lit above a closed shutter.",
    { collection: "apotek", position: "60% 30%" },
  ),
  shared("halo-sign", "Halo-lit sign", "signage", halo),
  item(
    "blade-sign",
    "Vertical blade sign",
    "signage",
    "Tall purple and gold blade sign projecting from a balcony over a busy street.",
    { position: "50% 35%" },
  ),
  item(
    "cut-out-logo-sign",
    "Cut-out logo sign",
    "signage",
    "White sign panel with a cut-out MAVID logo in blue and gold, leaning against a window.",
  ),
  item(
    "dimensional-fascia",
    "Dimensional fascia lettering",
    "signage",
    "Gold dimensional lettering on a dark shop fascia with a phone number, seen from below.",
    { position: "50% 30%" },
  ),
  shared("dimensional-letters", "Dimensional letters", "signage", dimensional),
  item(
    "lightbox-sign",
    "Lightbox sign",
    "signage",
    "Blue lightbox sign with yellow Samitto Liquor and Cafe lettering, propped on a pavement.",
  ),
  item(
    "street-fascia-boards",
    "Street-front fascia boards",
    "signage",
    "Two fascia boards on a building front: Braided by Bella above Main Street Pharmacy.",
  ),
  item(
    "shop-front-fascia",
    "Shop front fascia",
    "signage",
    "Teal apotek fascia above the glass doors of a skin care store.",
    { collection: "apotek", position: "50% 30%" },
  ),

  // Interiors
  shared("ceo-letters", "Interior dimensional letters", "interiors", {
    source: "IMG-20260921-WA0278.jpg",
    frame: featured,
  }),
  shared("interior-branding", "Interior branding", "interiors", interior),
  item(
    "wall-lettering",
    "Wall lettering",
    "interiors",
    "Nova Natural Organics lettering on a white wall above a small seating area.",
    { collection: "nova-natural-organics", position: "50% 35%" },
  ),
  item(
    "reception-wall-graphic",
    "Reception wall graphic",
    "interiors",
    "Lumasa Sports wall graphic with an athlete image on a glass partition.",
    { position: "50% 40%" },
  ),

  // Print
  item(
    "printed-labels",
    "Printed label sheets",
    "print",
    "Sheets of printed S&A monogram labels in black and in white with butterflies.",
  ),
  item(
    "business-cards",
    "Business cards",
    "print",
    "A white and a black Kivundu Avenue business card beside a keyboard.",
  ),
  item(
    "guest-book",
    "Guest book cover",
    "print",
    "Orange Twenty Eight Tours guest book with a foiled cover, held in a hand.",
  ),
  item(
    "framed-typographic-print",
    "Framed typographic print",
    "print",
    "Framed print reading What if it all works out, lettered over newspaper.",
  ),
  item(
    "framed-art-print",
    "Framed art print",
    "print",
    "Framed print of stacked black and grey half-circles on white.",
  ),

  // Merchandise
  shared("branded-caps", "Embroidered caps", "merchandise", caps),
  item(
    "polo-and-caps",
    "Polo shirt and caps",
    "merchandise",
    "White polo shirt and white caps with a Friends of Boxing logo.",
    { collection: "friends-of-boxing", position: "50% 25%" },
  ),
  item(
    "branded-flasks",
    "Branded flasks",
    "merchandise",
    "Three red flasks printed with the white NOVA Natural Organics logo.",
    { collection: "nova-natural-organics" },
  ),
  item(
    "embroidered-caps",
    "Embroidered trucker caps",
    "merchandise",
    "Black trucker caps embroidered with the green Nkata Mixed Farm logo.",
    { collection: "nkata-mixed-farm" },
  ),
  shared("gift-set", "Corporate gift set", "merchandise", gift),
  item(
    "branded-notebook",
    "Branded notebook",
    "merchandise",
    "Blue notebook printed with the Nkata Mixed Farm logo and Farming Organically.",
    { collection: "nkata-mixed-farm" },
  ),
  item(
    "umbrella-and-flask",
    "Umbrella and flask",
    "merchandise",
    "Black umbrella and black flask with red script branding.",
  ),
  item(
    "keyrings",
    "Keyrings",
    "merchandise",
    "Metal and printed keyrings in several shapes laid out on a dark cloth.",
  ),

  // Packaging
  item(
    "bottle-labels",
    "Bottle labels",
    "packaging",
    "Two white Nova coconut body lotion bottles with printed labels.",
    { collection: "nova-natural-organics" },
  ),
  item(
    "soap-boxes",
    "Soap boxes",
    "packaging",
    "A pile of printed Nova goat milk soap boxes, one held up to the camera.",
    { collection: "nova-natural-organics" },
  ),
  item(
    "product-label",
    "Jar label",
    "packaging",
    "Nova shea butter body cream jar lid with a black and white patterned label.",
    { collection: "nova-natural-organics", position: "50% 40%" },
  ),
  item(
    "printed-tote-bags",
    "Printed tote bags",
    "packaging",
    "White non-woven tote bags printed in blue with the Toys and Tales logo.",
    { collection: "toys-and-tales" },
  ),
  item(
    "branded-carrier-bags",
    "Branded carrier bags",
    "packaging",
    "Black Jay Scents carrier bags and garment printed in pink script.",
  ),

  // Events
  item(
    "event-backdrop",
    "Event backdrop",
    "events",
    "Step-and-repeat backdrop for One Love Tribute 2024 with sponsor logos.",
    { collection: "one-love-tribute" },
  ),
  item(
    "event-passes",
    "Event passes and lanyards",
    "events",
    "One Love Tribute 2024 crew and artist passes on coloured lanyards.",
    { collection: "one-love-tribute" },
  ),
  item(
    "round-card",
    "Round card",
    "events",
    "Octagonal Round 1 card with the Friends of Boxing logo beside boxing gloves.",
    { collection: "friends-of-boxing" },
  ),
  item(
    "launch-display-board",
    "Launch display board",
    "events",
    "Cut-out display board announcing the launch of the YALI Uganda Leadership and Mentorship Academy.",
  ),
  item(
    "roll-up-banners",
    "Roll-up banners",
    "events",
    "Three roll-up banners standing in a hallway.",
  ),
  item(
    "feather-flag",
    "Feather flag",
    "events",
    "A printed feather flag standing inside a print workshop.",
    { position: "50% 35%" },
  ),
];

export function getWorkItem(slug: string) {
  const found = workItems.find((w) => w.slug === slug);
  if (!found) throw new Error(`unknown work item ${slug}`);
  return found;
}

export function categoryLabel(id: WorkCategory) {
  return workCategories.find((c) => c.id === id)?.label ?? id;
}

export function isCategory(value: unknown): value is WorkCategory {
  return workCategories.some((c) => c.id === value);
}

/* ------------------------------------------------------------ collections */

export type CollectionSlug =
  | "nova-natural-organics"
  | "toys-and-tales"
  | "apotek"
  | "nkata-mixed-farm"
  | "one-love-tribute"
  | "friends-of-boxing";

export type Collection = {
  slug: CollectionSlug;
  /** The name as it appears on the pieces themselves. */
  name: string;
  /** What is visible across the pieces. Describes outputs, never outcomes. */
  summary: string;
  services: ServiceSlug[];
};

export const collections: Collection[] = [
  {
    slug: "nova-natural-organics",
    name: "Nova Natural Organics",
    summary:
      "One identity carried across wall lettering, product labels, soap boxes and branded flasks.",
    services: ["packaging", "branding", "corporate"],
  },
  {
    slug: "toys-and-tales",
    name: "Toys and Tales",
    summary:
      "An illuminated shop sign and printed tote bags for the same store.",
    services: ["signage", "packaging"],
  },
  {
    slug: "apotek",
    name: "apotek",
    summary: "The same fascia seen by day above the entrance and lit at night.",
    services: ["signage"],
  },
  {
    slug: "nkata-mixed-farm",
    name: "Nkata Mixed Farm",
    summary:
      "Embroidered caps and a printed notebook carrying the farm's logo.",
    services: ["corporate", "branding"],
  },
  {
    slug: "one-love-tribute",
    name: "One Love Tribute 2024",
    summary: "An event backdrop alongside crew and artist passes on lanyards.",
    services: ["printing", "design"],
  },
  {
    slug: "friends-of-boxing",
    name: "Friends of Boxing",
    summary:
      "Branded polo shirts and caps, and a printed round card for the ring.",
    services: ["corporate", "printing"],
  },
];

export function getCollection(slug: string) {
  return collections.find((c) => c.slug === slug) ?? null;
}

export function collectionItems(slug: CollectionSlug) {
  return workItems.filter((w) => w.collection === slug);
}

/** Items whose publication permission has not been confirmed. */
export function pendingItems() {
  return workItems.filter((w) => w.permission !== "approved");
}
