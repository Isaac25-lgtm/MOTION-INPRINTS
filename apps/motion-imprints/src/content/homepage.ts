import type { Frame } from "@/components/media/Picture";

/**
 * Motion Imprints homepage content and media.
 *
 * Every file is a derivative built by scripts/build-home-assets.py and
 * recorded in docs/phase-3-4-rescue/EXTERNAL-ASSET-REGISTER.md.
 *
 * kind:
 *   stock    licensed atmosphere, never presented as Motion work
 *   mockup   licensed stock with the supplied Motion logo composited on it
 *   genuine  real Motion photograph, enhanced derivative, owner-approved
 */

const R = "/media/home";

export const hero = {
  wide: {
    base: `${R}/hero/press-wide`,
    widths: [2400, 1600, 1100],
    width: 2400,
    height: 1350,
    alt: "Orange ink being worked onto the rollers of a printing press.",
    position: "60% 50%",
  },
  tall: {
    // Phones: a square crop that keeps the whole hand, spatula and ink.
    base: `${R}/hero/press-square`,
    widths: [1000, 700],
    width: 1000,
    height: 1000,
    alt: "A hand working orange ink onto the rollers of a printing press.",
    position: "50% 50%",
  },
} satisfies Record<string, Frame>;

export type Service = {
  area: "branding" | "signage" | "apparel" | "packaging";
  title: string;
  text: string;
  href: string;
  frame: Frame;
};

// Branding, Signage and Packaging are mockups (licensed stock + the supplied
// Motion logo). Apparel is a genuine, owner-approved Motion job.
export const services: Service[] = [
  {
    area: "branding",
    title: "Branding and Identity",
    text: "Logos, stationery and brand systems ready for print and production.",
    href: "/services/branding",
    frame: {
      base: `${R}/services/branding-stationery`,
      widths: [1400, 900, 560],
      width: 1400,
      height: 1560,
      alt: "A white business card with the Motion Imprints logo beside a Motion-blue card, on black.",
      position: "45% 40%",
    },
  },
  {
    area: "signage",
    title: "Signage and Environments",
    text: "Dimensional letters, fascias and interior graphics.",
    href: "/services/signage",
    frame: {
      base: `${R}/services/signage-reception`,
      widths: [1400, 900, 560],
      width: 1400,
      height: 793,
      alt: "The Motion Imprints logo mounted as dimensional letters on a timber reception wall.",
      position: "38% 45%",
    },
  },
  {
    area: "apparel",
    title: "Apparel and Merchandise",
    text: "Printed and embroidered garments, caps and promotional items.",
    href: "/services/corporate",
    // kind: genuine, owner-approved (IMG-20260921-WA0172.jpg)
    frame: {
      base: `${R}/services/apparel-branded`,
      widths: [1400, 900, 560],
      width: 1400,
      height: 1343,
      alt: "White polo shirts and caps printed with the Friends of Boxing logo.",
      position: "50% 50%",
    },
  },
  {
    area: "packaging",
    title: "Print and Packaging",
    text: "Printed bags, boxes, labels and campaign material.",
    href: "/services/packaging",
    frame: {
      base: `${R}/services/packaging-bag`,
      widths: [1400, 900, 560],
      width: 1400,
      height: 1697,
      alt: "Kraft paper bags on a dark background, one printed with the Motion Imprints logo.",
      position: "62% 45%",
    },
  },
];

// kind: genuine, owner-approved (IMG-20260921-WA0278.jpg)
export const featured: Frame = {
  base: `${R}/featured/ceo-letters`,
  widths: [1600, 1000, 640],
  width: 1600,
  height: 1200,
  alt: "Gold dimensional CEO letters under a crown, mounted on a timber-panelled wall.",
  position: "50% 55%",
};

export type WorkItem = { label: string; frame: Frame; source: string };

// kind: genuine, owner-approved. Never place stock or mockups here.
export const workLead: WorkItem[] = [
  {
    label: "Illuminated letters",
    source: "IMG-20260921-WA0254.jpg",
    frame: {
      base: `${R}/work/illuminated-letters`,
      widths: [1600, 1000, 640],
      width: 1600,
      height: 900,
      alt: "Red illuminated letters spelling MERIT CREDIT above a glossy floor.",
    },
  },
  {
    label: "Interior branding",
    source: "IMG-20260921-WA0176.jpg",
    frame: {
      base: `${R}/work/interior-branding`,
      widths: [1600, 1000, 640],
      width: 1600,
      height: 900,
      alt: "Feature wall with a gold monogram, a layered green panel and script lettering.",
    },
  },
];

export const workSupport: WorkItem[][] = [
  [
    {
      label: "Halo-lit sign",
      source: "IMG-20260921-WA0107.jpg",
      frame: {
        base: `${R}/work/halo-sign`,
        widths: [1000, 640],
        width: 1000,
        height: 1000,
        alt: "Circular halo-lit sign reading Karen Collections.",
      },
    },
    {
      label: "Dimensional letters",
      source: "IMG-20260921-WA0269.jpg",
      frame: {
        base: `${R}/work/dimensional-letters`,
        widths: [1600, 1000, 640],
        width: 1600,
        height: 1000,
        alt: "Dimensional ZIRO COFFEE letters fixed to a white panel.",
      },
    },
  ],
  [
    {
      label: "Branded merchandise",
      source: "IMG-20260921-WA0274.jpg",
      frame: {
        base: `${R}/work/branded-caps`,
        widths: [1600, 1000, 640],
        width: 1600,
        height: 1333,
        alt: "Caps embroidered with the Motion i mark on wooden shelves.",
      },
    },
    {
      label: "Corporate gift set",
      source: "IMG-20260921-WA0069.jpg",
      frame: {
        base: `${R}/work/gift-set`,
        widths: [1000, 640],
        width: 1000,
        height: 1250,
        alt: "Gift set with a monogrammed flask, pen and notebook in a red-lined box.",
      },
    },
  ],
];

export type Step = { index: string; title: string; text: string; frame: Frame };

export const steps: Step[] = [
  {
    index: "01",
    title: "Design",
    text: "Artwork, colour and layout set up for the way the piece will be made.",
    frame: {
      // kind: stock (Pexels 6474450)
      base: `${R}/process/design-swatches`,
      widths: [1100, 720],
      width: 1100,
      height: 825,
      alt: "Hands fanning open a colour swatch book.",
    },
  },
  {
    index: "02",
    title: "Produce",
    text: "Printing, cutting and decoration on the right material.",
    frame: {
      // kind: stock (Pexels 1509308)
      base: `${R}/process/produce-squeegee`,
      widths: [1100, 720],
      width: 1100,
      height: 825,
      alt: "A squeegee resting on a screen-printing frame.",
    },
  },
  {
    index: "03",
    title: "Finish",
    text: "Trimming, assembly and checks before anything leaves the workshop.",
    frame: {
      // kind: stock (Pexels 6621007)
      base: `${R}/process/finish-trimming`,
      widths: [1100, 720],
      width: 1100,
      height: 825,
      alt: "Hands trimming paper with a knife against a steel rule.",
    },
  },
  {
    index: "04",
    title: "Install",
    text: "Signs and graphics fitted in the space they were made for.",
    frame: {
      // kind: stock — generic installation, no third-party brand or client
      base: `${R}/process/install-panel`,
      widths: [1100, 720],
      width: 1100,
      height: 825,
      alt: "Hands mounting a frosted panel onto a dark wall.",
      position: "50% 50%",
    },
  },
];

// kind: stock (Pexels 7648514) — generic printed programmes, no brand
export const cta: Frame = {
  base: `${R}/cta/printed-programmes`,
  widths: [1400, 900],
  width: 1400,
  height: 982,
  alt: "Printed event programmes fanned out on a dark wooden table.",
  position: "50% 50%",
};

export const capabilities = [
  "Branding",
  "Signage",
  "Print and Packaging",
  "Apparel and Merchandise",
  "Environments",
] as const;

export const heroCopy = {
  titleLines: [
    "Design, print and production",
    "that makes brands visible",
  ] as const,
  lede: "Motion Imprints creates branding, signage, print, packaging and merchandise for businesses and institutions.",
};

export const servicesCopy = {
  eyebrow: "Services",
  title: "What we make",
  lede: "Four areas of work, from brand identity and print to signage, packaging and branded merchandise.",
};

export const featuredCopy = {
  eyebrow: "Featured piece",
  title: "Interior dimensional letters",
  lede: "Gold-faced letters mounted on a timber feature wall and lit from above.",
  tags: ["Signage", "Interiors"] as const,
};

export const workCopy = {
  eyebrow: "Portfolio",
  title: "Selected work",
  lede: "Signs, interiors and merchandise from recent projects.",
};

export const processCopy = {
  eyebrow: "Process",
  title: "From design to installation",
  lede: "How a job moves from artwork to the finished piece.",
};

export const closingCopy = {
  title: "Have a project in mind?",
  lede: "Tell us what you need designed, printed, produced or installed.",
};
