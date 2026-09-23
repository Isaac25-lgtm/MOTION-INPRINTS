import type { ServiceSlug } from "@/lib/nav";
import type { WorkCategory } from "./work";

/**
 * Service detail content. Route boundaries (slug, title, summary) live in
 * src/lib/nav.ts; this file carries the page copy.
 *
 * Truthfulness: describe what is offered and how to brief it. No prices,
 * turnaround times, capacities, guarantees, clients or results.
 *
 * Imagery: every work slug appears on at most one service page, so no two
 * service pages repeat a photograph.
 */

export type ServiceDetail = {
  slug: ServiceSlug;
  index: string;
  headline: string;
  lede: string;
  intro: string;
  deliverables: { title: string; text: string }[];
  applications: string[];
  considerations: { title: string; text: string }[];
  /** Genuine work: the first is the hero, the rest form the gallery. */
  work: [string, ...string[]];
  workCategory?: WorkCategory;
  related: ServiceSlug[];
  /** What a useful brief for this service contains. */
  brief: string[];
  /** Show the setup-to-digital cross-link to Technologies (OD-01). */
  technologies?: boolean;
};

export const serviceDetails: Record<ServiceSlug, ServiceDetail> = {
  design: {
    slug: "design",
    index: "01",
    headline: "Artwork that is ready to be made",
    lede: "Logos, layouts and campaign artwork prepared for the material, size and process they will be produced in.",
    intro:
      "Design at Motion sits next to production. Files are built for how the piece will actually be made: colour set up for the press or the vinyl, text sized for reading distance, and cut lines and bleed in place. What you approve on screen is what we go on to make.",
    deliverables: [
      {
        title: "Logo and identity",
        text: "A mark, colours and type that work at business-card size and on a shop front.",
      },
      {
        title: "Print layouts",
        text: "Flyers, brochures, programmes, menus, certificates and reports.",
      },
      {
        title: "Campaign and event artwork",
        text: "Backdrops, banners, posters and social graphics in one visual language.",
      },
      {
        title: "Label and packaging artwork",
        text: "Layouts on the correct die-line with room for the product information.",
      },
      {
        title: "Signage drawings",
        text: "Scaled artwork for letters, panels and wall graphics.",
      },
      {
        title: "File preparation",
        text: "Your existing artwork checked and set up for production.",
      },
    ],
    applications: [
      "New business launches",
      "Event branding",
      "Product labels",
      "Menus and price lists",
      "Reports and profiles",
      "Social media graphics",
    ],
    considerations: [
      {
        title: "Bring what you already have",
        text: "Existing logos, colours, photos and text save time. Vector files (AI, EPS, SVG or PDF) scale cleanly; screenshots and forwarded images usually need redrawing.",
      },
      {
        title: "Design for the viewing distance",
        text: "A sign read from across the street needs very different type from a business card. Sizes are set for where the piece will be seen.",
      },
      {
        title: "Screens glow, ink reflects",
        text: "Colour on a phone is brighter than colour on paper or vinyl. Where colour matters, ask for a printed proof before the full run.",
      },
    ],
    work: [
      "printed-labels",
      "framed-art-print",
      "cut-out-logo-sign",
      "guest-book",
      "round-card",
    ],
    related: ["branding", "printing", "packaging"],
    brief: [
      "What the design is for and where it will be used",
      "Any logo, colours, photos and text you already have",
      "Sizes, quantities and the production method if known",
      "The date you need it by",
    ],
    technologies: true,
  },

  printing: {
    slug: "printing",
    index: "02",
    headline: "Print, from a business card to a building banner",
    lede: "Commercial and large-format printing for stationery, publications, events and campaigns, finished and ready to use.",
    intro:
      "Small-format print is the paper you hand out and file. Large-format is what people read from across a room or a road. Both are finished before they leave: trimmed, laminated, bound, mounted or fitted with eyelets as the job needs.",
    deliverables: [
      {
        title: "Stationery",
        text: "Business cards, letterheads, envelopes, compliment slips and receipt books.",
      },
      {
        title: "Marketing print",
        text: "Flyers, brochures, posters, calendars and programmes.",
      },
      {
        title: "Large-format",
        text: "Banners, backdrops, roll-ups, posters and vinyl graphics.",
      },
      {
        title: "Stickers and labels",
        text: "Sheets, rolls and cut-to-shape stickers.",
      },
      {
        title: "Event print",
        text: "Passes, tickets, certificates, table cards and signs for the day.",
      },
      {
        title: "Finishing",
        text: "Lamination, binding, mounting, cutting and eyelets.",
      },
    ],
    applications: [
      "Office stationery",
      "Conferences and launches",
      "Ceremonies and celebrations",
      "Retail promotions",
      "Certificates",
      "Backdrops and stage branding",
    ],
    considerations: [
      {
        title: "Quantity changes the method",
        text: "Short and long runs are often printed differently. Tell us the quantity early and we will suggest the process that suits it.",
      },
      {
        title: "Paper weight and finish",
        text: "Heavier card feels more substantial for cards and invitations. Matt or gloss lamination protects items that get handled.",
      },
      {
        title: "Indoors or outdoors",
        text: "Banners and posters that live outside need materials that stand up to sun and rain. Say where the print will go.",
      },
    ],
    work: [
      "event-backdrop",
      "framed-typographic-print",
      "event-passes",
      "roll-up-banners",
      "feather-flag",
    ],
    workCategory: "print",
    related: ["design", "signage", "corporate"],
    brief: [
      "What you need printed, with sizes and quantities",
      "Artwork files, or a note that you need design too",
      "Paper, finish or material if you have a preference",
      "Delivery location and the date you need it by",
    ],
  },

  branding: {
    slug: "branding",
    index: "03",
    headline: "One identity, everywhere it appears",
    lede: "Turning a logo into a consistent presence across stationery, uniforms, signage, packaging and the walls of your space.",
    intro:
      "Branding is where design meets the physical world. The same colours, logo and type have to hold up on paper, fabric, acrylic, vinyl and paint. We plan the pieces together, so a customer meets one business rather than a collection of suppliers.",
    deliverables: [
      {
        title: "Application plan",
        text: "Which items you need first, and how the logo sits on each of them.",
      },
      {
        title: "Stationery sets",
        text: "Cards, letterheads, envelopes and folders that match.",
      },
      {
        title: "Uniform branding",
        text: "Printed or embroidered shirts, caps and name badges for staff.",
      },
      {
        title: "Environmental branding",
        text: "Reception logos, wall lettering and window graphics.",
      },
      {
        title: "Branded items",
        text: "Notebooks, flasks, pens and gifts in your colours.",
      },
      {
        title: "Brand guidelines",
        text: "A short reference so every future supplier uses the logo correctly.",
      },
    ],
    applications: [
      "Opening a new shop or office",
      "Rebrands",
      "New branches",
      "Staff uniforms",
      "Trade fairs and exhibitions",
      "Reception areas",
    ],
    considerations: [
      {
        title: "Start with a clean logo file",
        text: "Every application depends on it. If you only have a low-resolution image, the logo is redrawn first.",
      },
      {
        title: "Materials change colour",
        text: "The same blue looks different on vinyl, fabric and paper. Colour is checked across materials before a full order.",
      },
      {
        title: "Roll it out in stages",
        text: "A new business rarely needs everything at once. Order what customers see first: the sign, the cards, the uniforms.",
      },
    ],
    work: [
      "business-cards",
      "wall-lettering",
      "shop-front-fascia",
      "branded-notebook",
      "reception-wall-graphic",
    ],
    workCategory: "interiors",
    related: ["design", "signage", "corporate"],
    brief: [
      "Your logo files and brand colours, if they exist",
      "The places and items the brand needs to appear on",
      "Which pieces are needed first",
      "Opening date or launch deadline",
    ],
    technologies: true,
  },

  signage: {
    slug: "signage",
    index: "04",
    headline: "Signs people can find you by",
    lede: "Shop fascias, illuminated signs, dimensional letters, wayfinding, banners and pull-ups, made for where they will hang.",
    intro:
      "A sign has one job: to be seen and understood from where your customers are. That decides its size, its material, whether it is lit and how it is fixed. We make signage for shop fronts, offices, clinics and events, and fit it on site.",
    deliverables: [
      {
        title: "Shop fascias",
        text: "Panel and box signs across the front of a building.",
      },
      {
        title: "Illuminated signs",
        text: "Lightboxes, lit letters and halo-lit logos that keep working after dark.",
      },
      {
        title: "Dimensional letters",
        text: "Raised letters and logos, cut from sheet material and fixed off the wall.",
      },
      {
        title: "Interior and wayfinding",
        text: "Door plates, directional signs, room numbers and safety signs.",
      },
      {
        title: "Banners and pull-ups",
        text: "Portable signs for events, launches and promotions.",
      },
      {
        title: "Installation",
        text: "Fitting on site with fixings suited to the wall.",
      },
    ],
    applications: [
      "Shop fronts",
      "Offices and receptions",
      "Clinics and pharmacies",
      "Restaurants and cafés",
      "Events and launches",
      "Wayfinding inside buildings",
    ],
    considerations: [
      {
        title: "Measure the space",
        text: "Width, height and reading distance decide letter size. A photo of the wall with a tape measure in it is a good start.",
      },
      {
        title: "Lit or unlit",
        text: "If you trade after dark, an illuminated sign keeps working. It needs a power point close to where it will hang.",
      },
      {
        title: "Check permissions",
        text: "Some buildings and local authorities need to approve external signs. Confirm with your landlord before ordering.",
      },
    ],
    work: [
      "illuminated-shop-sign",
      "fascia-at-night",
      "blade-sign",
      "lightbox-sign",
      "dimensional-fascia",
    ],
    workCategory: "signage",
    related: ["branding", "printing", "design"],
    brief: [
      "Where the sign will go, with photos of the wall or front",
      "Approximate width and height available",
      "Whether it should be lit",
      "Your logo and wording, and the date you need it installed",
    ],
  },

  packaging: {
    slug: "packaging",
    index: "05",
    headline: "Packaging that belongs on the shelf",
    lede: "Labels, boxes, bags and product print for small producers and growing brands.",
    intro:
      "Packaging is often the first part of a brand a customer holds. It has to look like one brand across the range, carry the information buyers expect, and survive handling. Labels, boxes and bags are designed and printed with all three in mind.",
    deliverables: [
      {
        title: "Product labels",
        text: "For jars, bottles, tubs and packets, sized to your containers.",
      },
      {
        title: "Printed boxes",
        text: "Folding boxes for soap, cosmetics, food and gifts.",
      },
      {
        title: "Branded bags",
        text: "Paper, non-woven and carrier bags printed with your logo.",
      },
      {
        title: "Stickers and seals",
        text: "Closures, promotional stickers and batch labels.",
      },
      {
        title: "Packaging design",
        text: "Artwork on the correct die-line, with space for ingredients, weights and barcodes.",
      },
      {
        title: "Range consistency",
        text: "One look across several products and sizes.",
      },
    ],
    applications: [
      "Cosmetics and body care",
      "Food and drinks",
      "Retail shopping bags",
      "Gift packaging",
      "Product launches",
      "Small-batch producers",
    ],
    considerations: [
      {
        title: "Measure the container",
        text: "A label has to fit the flat area and the curve of the container. Send a sample or its exact dimensions.",
      },
      {
        title: "Water and handling",
        text: "Bathroom products and chilled drinks need labels that tolerate moisture. Tell us how the product is stored and used.",
      },
      {
        title: "Required information",
        text: "Many products need ingredients, weight, batch and expiry details. You supply the content; the design makes room for it.",
      },
    ],
    work: [
      "bottle-labels",
      "soap-boxes",
      "product-label",
      "printed-tote-bags",
      "branded-carrier-bags",
    ],
    workCategory: "packaging",
    related: ["design", "printing", "branding"],
    brief: [
      "The product and its container, with a sample or dimensions",
      "Quantities for each product or size",
      "The text that must appear on the pack",
      "Your logo and the date you need it by",
    ],
  },

  corporate: {
    slug: "corporate",
    index: "06",
    headline: "Branded apparel and gifts people keep",
    lede: "Printed and embroidered uniforms, caps, flasks, notebooks, umbrellas and gift sets for teams, events and clients.",
    intro:
      "Corporate and promotional items put your name in people's hands and on their backs. The best ones are useful enough to keep. Apparel and everyday items are branded for staff, events and client gifts.",
    deliverables: [
      {
        title: "Uniforms and apparel",
        text: "Polo shirts, T-shirts, reflective vests and jackets, printed or embroidered.",
      },
      {
        title: "Caps and headwear",
        text: "Embroidered and printed caps.",
      },
      {
        title: "Drinkware",
        text: "Flasks, bottles and mugs carrying your logo.",
      },
      {
        title: "Office items",
        text: "Notebooks, pens, diaries and desk items.",
      },
      {
        title: "Gifts and awards",
        text: "Gift sets, acrylic awards and keyrings for clients and events.",
      },
      {
        title: "Event merchandise",
        text: "Lanyards, passes, umbrellas and giveaways.",
      },
    ],
    applications: [
      "Staff uniforms",
      "Conference packs",
      "Client gifts",
      "Sports teams and clubs",
      "Product launches",
      "End-of-year awards",
    ],
    considerations: [
      {
        title: "Printed or embroidered",
        text: "Embroidery is hard-wearing and suits caps and polos. Printing suits large, detailed or full-colour designs.",
      },
      {
        title: "Sizes with the order",
        text: "For apparel, send the size breakdown with the order so each person gets the right fit.",
      },
      {
        title: "Choose items that get used",
        text: "Something used every day keeps the brand in view far longer than something that goes into a drawer.",
      },
    ],
    work: [
      "polo-and-caps",
      "branded-flasks",
      "embroidered-caps",
      "umbrella-and-flask",
      "keyrings",
    ],
    workCategory: "merchandise",
    related: ["branding", "printing", "design"],
    brief: [
      "The items you want and the quantity of each",
      "Size breakdown for apparel",
      "Printed or embroidered, if you know",
      "Your logo and the date you need them by",
    ],
  },
};
