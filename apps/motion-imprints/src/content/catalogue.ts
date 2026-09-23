import type { Frame } from "@/components/media/Picture";
import type { ServiceSlug } from "@/lib/nav";
import productMedia from "./product-media.json";
import { getWorkItem } from "./work";

/**
 * Motion Imprints product catalogue.
 *
 * Every product is priced on quotation: no fixed prices, stock counts, minimum
 * quantities or lead times are published, because none has been confirmed.
 * Options are the specifications a quotation needs, not a promise that every
 * combination is available; the team confirms on reply.
 *
 * Pictures are genuine pieces from the Motion archive (permission pending,
 * listed by launch:check), shown as examples of the product type.
 */

export type ProductCategory =
  "print" | "display" | "signage" | "apparel" | "promotional" | "packaging";

export const productCategories: {
  id: ProductCategory;
  label: string;
  intro: string;
}[] = [
  {
    id: "print",
    label: "Print",
    intro: "Stationery, marketing print, labels and wall prints.",
  },
  {
    id: "display",
    label: "Banners and events",
    intro: "Portable banners, flags, backdrops and event essentials.",
  },
  {
    id: "signage",
    label: "Signage",
    intro: "Illuminated signs, letters, fascias and wayfinding.",
  },
  {
    id: "apparel",
    label: "Apparel",
    intro: "Branded shirts, caps, vests and aprons.",
  },
  {
    id: "promotional",
    label: "Promotional items",
    intro: "Drinkware, stationery, gifts and awards.",
  },
  {
    id: "packaging",
    label: "Packaging",
    intro: "Labels, boxes and bags for products and shops.",
  },
];

export type OptionGroup = { id: string; label: string; choices: string[] };

export type Product = {
  slug: string;
  title: string;
  category: ProductCategory;
  summary: string;
  /** What the product is typically used for. */
  goodFor: string[];
  /** What to tell us in the notes so the quotation is accurate. */
  specify: string[];
  options: OptionGroup[];
  /** Plural noun for the quantity field, e.g. "cards". */
  unit: string;
  pricing: "quote";
  service: ServiceSlug;
  image: Frame;
};

type Built = { widths: number[]; width: number; height: number };
const built = productMedia as Record<string, Built>;

function productImage(slug: string, alt: string, position?: string): Frame {
  const m = built[slug];
  if (!m) throw new Error(`product media missing for ${slug}`);
  return {
    base: `/media/products/${slug}`,
    widths: m.widths,
    width: m.width,
    height: m.height,
    alt,
    position,
  };
}

function workImage(slug: string): Frame {
  return getWorkItem(slug).frame;
}

const notSure = "Not sure yet";

const sides: OptionGroup = {
  id: "sides",
  label: "Printed sides",
  choices: ["Single-sided", "Double-sided"],
};

const placement: OptionGroup = {
  id: "location",
  label: "Location",
  choices: ["Indoor", "Outdoor", notSure],
};

const install: OptionGroup = {
  id: "install",
  label: "Installation",
  choices: ["Install on site", "Supply only", notSure],
};

function product(p: Omit<Product, "pricing">): Product {
  return { ...p, pricing: "quote" };
}

export const products: Product[] = [
  // ------------------------------------------------------------------ print
  product({
    slug: "business-cards",
    title: "Business cards",
    category: "print",
    summary: "Cards that carry your name, number and brand into every meeting.",
    goodFor: ["New businesses", "Staff sets", "Events and networking"],
    specify: [
      "Names and details for each card",
      "Your logo, or ask us to design the card",
    ],
    options: [
      sides,
      {
        id: "finish",
        label: "Finish",
        choices: [
          "No lamination",
          "Matt lamination",
          "Gloss lamination",
          notSure,
        ],
      },
    ],
    unit: "cards",
    service: "printing",
    image: workImage("business-cards"),
  }),
  product({
    slug: "flyers-and-brochures",
    title: "Flyers and brochures",
    category: "print",
    summary: "Single sheets and folded brochures for promotions and profiles.",
    goodFor: ["Launch promotions", "Price lists and menus", "Company profiles"],
    specify: [
      "Number of pages or folds",
      "Artwork, or the text and images to use",
    ],
    options: [
      {
        id: "format",
        label: "Format",
        choices: ["Flyer", "Folded brochure", "Poster"],
      },
      {
        id: "size",
        label: "Size",
        choices: ["A6", "A5", "A4", "A3", "Other size"],
      },
      sides,
    ],
    unit: "copies",
    service: "printing",
    image: productImage(
      "flyers",
      "Printed travel agency flyers laid out on a shop floor.",
    ),
  }),
  product({
    slug: "stickers-and-labels",
    title: "Stickers and labels",
    category: "print",
    summary: "Branded stickers and label sheets for packs, bags and giveaways.",
    goodFor: [
      "Sealing bags and boxes",
      "Promotional giveaways",
      "Product marking",
    ],
    specify: ["Size and shape of each sticker", "Number of different designs"],
    options: [
      {
        id: "supply",
        label: "Supplied as",
        choices: ["Sheets", "Cut to shape", notSure],
      },
      placement,
    ],
    unit: "stickers",
    service: "printing",
    image: workImage("printed-labels"),
  }),
  product({
    slug: "guest-books",
    title: "Guest books",
    category: "print",
    summary: "Branded guest books for receptions, hotels and events.",
    goodFor: ["Hotels and lodges", "Receptions", "Weddings and ceremonies"],
    specify: ["Cover wording and logo", "Number of pages if known"],
    options: [
      {
        id: "cover",
        label: "Cover",
        choices: ["Printed cover", "Foiled cover", notSure],
      },
    ],
    unit: "books",
    service: "printing",
    image: workImage("guest-book"),
  }),
  product({
    slug: "framed-prints",
    title: "Framed prints",
    category: "print",
    summary: "Artwork, quotes and photographs printed and framed for walls.",
    goodFor: ["Offices and receptions", "Gifts", "Homes and cafés"],
    specify: ["The artwork or photograph", "Wall space available"],
    options: [
      {
        id: "size",
        label: "Size",
        choices: ["A4", "A3", "A2", "A1", "Other size"],
      },
      {
        id: "frame",
        label: "Frame colour",
        choices: ["Black", "White", "Natural wood", notSure],
      },
    ],
    unit: "prints",
    service: "printing",
    image: workImage("framed-art-print"),
  }),
  product({
    slug: "canvas-prints",
    title: "Canvas and wall panels",
    category: "print",
    summary: "Large wall prints, single or split across several panels.",
    goodFor: ["Office walls", "Receptions", "Restaurants"],
    specify: ["Wall width and height", "The image or artwork"],
    options: [
      {
        id: "panels",
        label: "Panels",
        choices: ["Single panel", "Split across panels", notSure],
      },
    ],
    unit: "prints",
    service: "printing",
    image: productImage(
      "canvas-print",
      "A black and white abstract print split across two wall panels.",
    ),
  }),

  // ---------------------------------------------------- banners and events
  product({
    slug: "roll-up-banners",
    title: "Roll-up banners",
    category: "display",
    summary:
      "Portable banners that stand up in seconds at events and receptions.",
    goodFor: ["Exhibitions", "Launches", "Reception areas"],
    specify: ["Artwork, or the message and logo to use"],
    options: [
      {
        id: "size",
        label: "Size",
        choices: ["85 × 200 cm", "100 × 200 cm", "120 × 200 cm", notSure],
      },
      {
        id: "stand",
        label: "Stand",
        choices: ["Print and stand", "Replacement print only"],
      },
    ],
    unit: "banners",
    service: "signage",
    image: workImage("roll-up-banners"),
  }),
  product({
    slug: "teardrop-flags",
    title: "Teardrop flags",
    category: "display",
    summary: "Curved flags that stay readable in the wind outside venues.",
    goodFor: ["Shop entrances", "Outdoor events", "Roadside promotion"],
    specify: ["Where the flag will stand, and on what ground"],
    options: [
      {
        id: "size",
        label: "Size",
        choices: ["Small", "Medium", "Large", notSure],
      },
      {
        id: "base",
        label: "Base",
        choices: ["Ground spike", "Cross base", notSure],
      },
    ],
    unit: "flags",
    service: "signage",
    image: productImage(
      "teardrop-flag",
      "A green teardrop flag printed for a climate activism schools chapter.",
    ),
  }),
  product({
    slug: "feather-flags",
    title: "Feather flags",
    category: "display",
    summary: "Tall feather-shaped flags that add height and colour to a site.",
    goodFor: ["Forecourts", "Sports events", "Promotions"],
    specify: ["Where the flag will stand, and on what ground"],
    options: [
      {
        id: "size",
        label: "Size",
        choices: ["Small", "Medium", "Large", notSure],
      },
      {
        id: "base",
        label: "Base",
        choices: ["Ground spike", "Cross base", notSure],
      },
    ],
    unit: "flags",
    service: "signage",
    image: workImage("feather-flag"),
  }),
  product({
    slug: "pvc-banners",
    title: "PVC banners",
    category: "display",
    summary: "Printed banners for shop fronts, fences, stages and walls.",
    goodFor: ["Shop promotions", "Construction hoardings", "Events"],
    specify: ["Width and height", "How it will be hung"],
    options: [
      {
        id: "finishing",
        label: "Finishing",
        choices: ["Eyelets", "Pole pockets", "No finishing", notSure],
      },
      placement,
    ],
    unit: "banners",
    service: "printing",
    image: productImage(
      "pvc-banner",
      "A long printed banner for a fried chicken restaurant laid out on a tiled floor.",
    ),
  }),
  product({
    slug: "event-backdrops",
    title: "Event backdrops",
    category: "display",
    summary: "Step-and-repeat and stage backdrops for launches and ceremonies.",
    goodFor: ["Media walls", "Stage branding", "Photo points"],
    specify: ["Width and height of the space", "Logos to include"],
    options: [
      {
        id: "type",
        label: "Type",
        choices: ["Step-and-repeat", "Stage backdrop", notSure],
      },
      {
        id: "frame",
        label: "Frame",
        choices: ["Print and frame", "Print only", notSure],
      },
    ],
    unit: "backdrops",
    service: "printing",
    image: workImage("event-backdrop"),
  }),
  product({
    slug: "event-passes",
    title: "Event passes and lanyards",
    category: "display",
    summary: "Printed passes for crew, guests and artists, with lanyards.",
    goodFor: ["Concerts", "Conferences", "Staff identification"],
    specify: ["Pass categories and how many of each"],
    options: [
      {
        id: "lanyard",
        label: "Lanyard",
        choices: ["Plain lanyard", "Printed lanyard", "No lanyard"],
      },
    ],
    unit: "passes",
    service: "printing",
    image: workImage("event-passes"),
  }),
  product({
    slug: "wristbands",
    title: "Event wristbands",
    category: "display",
    summary: "Colour-coded wristbands for entry control at events.",
    goodFor: ["Ticketed events", "VIP areas", "Festivals"],
    specify: ["Colours needed and how many of each"],
    options: [
      {
        id: "colours",
        label: "Colours",
        choices: ["One colour", "Several colours"],
      },
    ],
    unit: "wristbands",
    service: "printing",
    image: productImage(
      "wristbands",
      "A row of event wristbands in pink, purple, green, red, blue and lilac.",
    ),
  }),

  // --------------------------------------------------------------- signage
  product({
    slug: "lightbox-signs",
    title: "Lightbox signs",
    category: "signage",
    summary: "Illuminated signs that keep your name visible after dark.",
    goodFor: ["Shop fronts", "Bars and restaurants", "Pharmacies"],
    specify: [
      "Photos of where the sign will go",
      "Approximate size, and whether a power point is nearby",
    ],
    options: [
      {
        id: "shape",
        label: "Shape",
        choices: ["Rectangular", "Round", "Custom shape"],
      },
      {
        id: "sides",
        label: "Faces",
        choices: ["Single-sided", "Double-sided (projecting)"],
      },
      install,
    ],
    unit: "signs",
    service: "signage",
    image: productImage(
      "round-lightbox",
      "A round lit sign reading Venom Lounge UG with a green logo.",
    ),
  }),
  product({
    slug: "3d-letters",
    title: "3D letters and logos",
    category: "signage",
    summary: "Raised letters and logos for walls, receptions and fascias.",
    goodFor: ["Reception walls", "Shop fascias", "Feature walls"],
    specify: ["Wording and logo", "Wall width available"],
    options: [
      {
        id: "lighting",
        label: "Lighting",
        choices: ["Unlit", "Front-lit", "Halo-lit", notSure],
      },
      placement,
      install,
    ],
    unit: "signs",
    service: "signage",
    image: workImage("dimensional-letters"),
  }),
  product({
    slug: "shop-fascias",
    title: "Shop fascia boards",
    category: "signage",
    summary: "The main sign across the front of your shop or office.",
    goodFor: ["New shops", "Rebrands", "Branch openings"],
    specify: ["Width and height of the fascia", "Photos of the building front"],
    options: [
      {
        id: "lighting",
        label: "Lighting",
        choices: ["Unlit", "Illuminated", notSure],
      },
      install,
    ],
    unit: "signs",
    service: "signage",
    image: workImage("street-fascia-boards"),
  }),
  product({
    slug: "wayfinding-signs",
    title: "Wayfinding and door signs",
    category: "signage",
    summary: "Door plates, direction signs, room numbers and marker plates.",
    goodFor: ["Offices", "Clinics and schools", "Utilities and sites"],
    specify: ["A list of every sign and its wording"],
    options: [
      {
        id: "type",
        label: "Type",
        choices: [
          "Door plates",
          "Directional signs",
          "Marker plates",
          "Mixed set",
        ],
      },
      placement,
    ],
    unit: "signs",
    service: "signage",
    image: productImage(
      "wayfinding-plates",
      "Blue marker plates with white lettering, held up in the workshop.",
    ),
  }),

  // --------------------------------------------------------------- apparel
  product({
    slug: "t-shirts",
    title: "Branded T-shirts",
    category: "apparel",
    summary: "Printed T-shirts for teams, events, campaigns and merchandise.",
    goodFor: ["Events and launches", "Staff uniforms", "Merchandise"],
    specify: ["Size breakdown", "Shirt colour"],
    options: [
      {
        id: "decoration",
        label: "Decoration",
        choices: ["Printed", "Embroidered", notSure],
      },
      {
        id: "position",
        label: "Branding position",
        choices: ["Front", "Back", "Front and back"],
      },
    ],
    unit: "shirts",
    service: "corporate",
    image: productImage(
      "t-shirts",
      "White T-shirts printed with the colourful Toys and Tales logo, laid on grass.",
    ),
  }),
  product({
    slug: "polo-shirts",
    title: "Branded polo shirts",
    category: "apparel",
    summary:
      "Polo shirts that make staff and teams look like one organisation.",
    goodFor: ["Staff uniforms", "Sports clubs", "Field teams"],
    specify: ["Size breakdown", "Shirt colour"],
    options: [
      {
        id: "decoration",
        label: "Decoration",
        choices: ["Embroidered", "Printed", notSure],
      },
      {
        id: "position",
        label: "Branding position",
        choices: ["Chest", "Back", "Chest and back"],
      },
    ],
    unit: "shirts",
    service: "corporate",
    image: productImage(
      "polo-shirts",
      "A white polo shirt printed with FOB UPBC Building Ugandan Boxing Together.",
    ),
  }),
  product({
    slug: "caps",
    title: "Branded caps",
    category: "apparel",
    summary: "Embroidered and printed caps for teams, events and giveaways.",
    goodFor: ["Promotions", "Outdoor teams", "Merchandise"],
    specify: ["Cap colour", "Logo files"],
    options: [
      {
        id: "decoration",
        label: "Decoration",
        choices: ["Embroidered", "Printed", notSure],
      },
      {
        id: "style",
        label: "Style",
        choices: ["Baseball cap", "Trucker cap", notSure],
      },
    ],
    unit: "caps",
    service: "corporate",
    image: workImage("embroidered-caps"),
  }),
  product({
    slug: "reflective-vests",
    title: "Reflective vests",
    category: "apparel",
    summary:
      "High-visibility vests branded with your name for field and site teams.",
    goodFor: ["Construction and utilities", "Event marshals", "Delivery teams"],
    specify: ["Size breakdown", "Wording for front and back"],
    options: [
      {
        id: "colour",
        label: "Vest colour",
        choices: ["Orange", "Yellow", notSure],
      },
      {
        id: "position",
        label: "Branding position",
        choices: ["Front", "Back", "Front and back"],
      },
    ],
    unit: "vests",
    service: "corporate",
    image: productImage(
      "reflective-vest",
      "An orange reflective vest printed with the SafiServe logo.",
    ),
  }),
  product({
    slug: "aprons",
    title: "Branded aprons",
    category: "apparel",
    summary: "Aprons for kitchens, salons, shops and market stalls.",
    goodFor: ["Restaurants and cafés", "Salons", "Retail counters"],
    specify: ["Apron colour", "Logo files"],
    options: [
      {
        id: "decoration",
        label: "Decoration",
        choices: ["Printed", "Embroidered", notSure],
      },
    ],
    unit: "aprons",
    service: "corporate",
    image: productImage(
      "aprons",
      "Green aprons printed with the Hapii Herbal Products logo.",
    ),
  }),

  // ----------------------------------------------------- promotional items
  product({
    slug: "flasks",
    title: "Branded flasks",
    category: "promotional",
    summary: "Insulated flasks with your logo, used every day.",
    goodFor: ["Client gifts", "Staff welcome packs", "Conferences"],
    specify: ["Flask colour", "Logo files"],
    options: [
      {
        id: "branding",
        label: "Branding",
        choices: ["One side", "Both sides"],
      },
    ],
    unit: "flasks",
    service: "corporate",
    image: workImage("branded-flasks"),
  }),
  product({
    slug: "mugs",
    title: "Branded mugs",
    category: "promotional",
    summary: "Mugs for offices, cafés and gifts.",
    goodFor: ["Office kitchens", "Client gifts", "Cafés"],
    specify: ["Mug colour", "Logo or artwork"],
    options: [
      {
        id: "branding",
        label: "Branding",
        choices: ["One side", "Both sides", "Wrap-around"],
      },
    ],
    unit: "mugs",
    service: "corporate",
    image: productImage(
      "mugs",
      "Black mugs and flasks with red script branding on a desk.",
    ),
  }),
  product({
    slug: "notebooks",
    title: "Branded notebooks",
    category: "promotional",
    summary: "Notebooks and diaries carrying your logo on the cover.",
    goodFor: ["Conference packs", "Staff stationery", "Client gifts"],
    specify: ["Cover colour", "Logo files"],
    options: [
      {
        id: "size",
        label: "Size",
        choices: ["A5", "A6", "Other size"],
      },
    ],
    unit: "notebooks",
    service: "corporate",
    image: workImage("branded-notebook"),
  }),
  product({
    slug: "umbrellas",
    title: "Branded umbrellas",
    category: "promotional",
    summary: "Umbrellas that carry your name through rain and sun.",
    goodFor: ["Client gifts", "Outdoor events", "Hotels and lodges"],
    specify: ["Umbrella colour", "Logo files"],
    options: [
      {
        id: "panels",
        label: "Branded panels",
        choices: ["One panel", "Two panels", "All panels"],
      },
    ],
    unit: "umbrellas",
    service: "corporate",
    image: workImage("umbrella-and-flask"),
  }),
  product({
    slug: "keyrings",
    title: "Keyrings",
    category: "promotional",
    summary: "Small, lasting giveaways in metal or with printed inserts.",
    goodFor: ["Estate agents and hotels", "Events", "Giveaways"],
    specify: ["Logo or artwork", "Preferred shape"],
    options: [
      {
        id: "type",
        label: "Type",
        choices: ["Metal", "Printed insert", notSure],
      },
    ],
    unit: "keyrings",
    service: "corporate",
    image: workImage("keyrings"),
  }),
  product({
    slug: "acrylic-awards",
    title: "Acrylic awards",
    category: "promotional",
    summary: "Clear awards carrying your wording and logo, for recognition.",
    goodFor: ["End-of-year awards", "Appreciation", "Sports"],
    specify: ["Wording for each award", "Logo files"],
    options: [
      {
        id: "base",
        label: "Base",
        choices: ["With wooden base", "Without base", notSure],
      },
    ],
    unit: "awards",
    service: "corporate",
    image: productImage(
      "acrylic-awards",
      "Clear acrylic awards on wooden bases in a display cabinet.",
    ),
  }),
  product({
    slug: "gift-sets",
    title: "Corporate gift sets",
    category: "promotional",
    summary: "Boxed sets of branded items for clients, guests and staff.",
    goodFor: ["Client gifts", "Board and guest packs", "Staff recognition"],
    specify: ["Which items to include", "Logo or monogram"],
    options: [
      {
        id: "box",
        label: "Presentation",
        choices: ["Gift box", "No box", notSure],
      },
    ],
    unit: "sets",
    service: "corporate",
    image: workImage("gift-set"),
  }),

  // ------------------------------------------------------------- packaging
  product({
    slug: "product-labels",
    title: "Product labels",
    category: "packaging",
    summary: "Labels for bottles, jars and tubs, sized to your containers.",
    goodFor: ["Cosmetics and body care", "Food and drinks", "Small producers"],
    specify: ["Container type and size", "Text that must appear on the label"],
    options: [
      {
        id: "container",
        label: "Container",
        choices: ["Bottle", "Jar or tub", "Packet", "Other"],
      },
      {
        id: "finish",
        label: "Finish",
        choices: ["Standard", "Water-resistant", notSure],
      },
    ],
    unit: "labels",
    service: "packaging",
    image: workImage("bottle-labels"),
  }),
  product({
    slug: "printed-boxes",
    title: "Printed boxes",
    category: "packaging",
    summary: "Folding boxes for soap, cosmetics, food and gifts.",
    goodFor: ["Retail products", "Gifts", "Product launches"],
    specify: ["Product dimensions", "Text and artwork for each face"],
    options: [
      {
        id: "style",
        label: "Style",
        choices: ["Folding box", "Sleeve", notSure],
      },
    ],
    unit: "boxes",
    service: "packaging",
    image: workImage("soap-boxes"),
  }),
  product({
    slug: "tote-bags",
    title: "Printed tote bags",
    category: "packaging",
    summary: "Reusable shopping bags printed with your logo.",
    goodFor: ["Shops", "Conferences", "Giveaways"],
    specify: ["Bag colour", "Logo files"],
    options: [
      {
        id: "print",
        label: "Printed sides",
        choices: ["One side", "Both sides"],
      },
    ],
    unit: "bags",
    service: "packaging",
    image: workImage("printed-tote-bags"),
  }),
  product({
    slug: "paper-bags",
    title: "Branded paper bags",
    category: "packaging",
    summary: "Paper carrier bags with handles for boutiques and gifts.",
    goodFor: ["Boutiques", "Gift shops", "Events"],
    specify: ["Bag size", "Logo files"],
    options: [
      {
        id: "print",
        label: "Printed sides",
        choices: ["One side", "Both sides"],
      },
      {
        id: "handles",
        label: "Handles",
        choices: ["Rope handles", "Paper handles", notSure],
      },
    ],
    unit: "bags",
    service: "packaging",
    image: productImage(
      "paper-bags",
      "A white paper bag with black rope handles printed with the Trendy Hanger logo.",
    ),
  }),
];

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug) ?? null;
}

export function categoryInfo(id: ProductCategory) {
  const found = productCategories.find((c) => c.id === id);
  if (!found) throw new Error(`unknown category ${id}`);
  return found;
}

export function isProductCategory(value: unknown): value is ProductCategory {
  return productCategories.some((c) => c.id === value);
}

export function relatedProducts(product: Product, count = 3) {
  return products
    .filter((p) => p.category === product.category && p.slug !== product.slug)
    .slice(0, count);
}
