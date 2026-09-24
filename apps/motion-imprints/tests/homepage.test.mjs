import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(appRoot, p), "utf8");

test("the approved homepage is the only homepage", () => {
  const home = read("src/app/(site)/page.tsx");
  assert.match(home, /HomeSections/);
  assert.match(home, /<Hero \/>/);
  assert.match(home, /<SelectedWork \/>/);
  assert.equal(
    existsSync(join(appRoot, "src/app/visual-rescue-preview")),
    false,
  );
  assert.doesNotMatch(read("src/lib/nav.ts"), /visual-rescue-preview/);
});

test("the rejected homepage is gone, not hidden at another route", () => {
  const sections = read("src/components/home/HomeSections.tsx");
  const content = read("src/content/homepage.ts");
  const css = read("src/styles/home.css");
  // Headings from the rejected poem-like page.
  for (const line of [
    "Built to occupy space",
    "Identity, on the wall",
    "Letters with weight",
    "Held in the hand",
    "Made to be worn",
    "From the floor",
    "Self-brand study",
  ]) {
    for (const [name, source] of Object.entries({ sections, content, css })) {
      assert.doesNotMatch(source, new RegExp(line, "i"), `${line} in ${name}`);
    }
  }
  // Its components and media directory are deleted, not parked.
  for (const gone of [
    "src/components/home/CapabilityMarquee.tsx",
    "src/components/home/Media.tsx",
    "src/components/rescue",
    "src/components/SiteShell.tsx",
    "public/media/homepage",
  ]) {
    assert.equal(existsSync(join(appRoot, gone)), false, gone);
  }
});

test("typography is Inter Tight and Inter, with Syne and Outfit removed", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /Inter_Tight/);
  assert.match(layout, /Inter\b/);
  assert.doesNotMatch(layout, /Syne|Outfit/);
  assert.doesNotMatch(read("src/styles/tokens.css"), /Syne|Outfit/);
  // Fonts load once, in the root layout only.
  const others = ["src/app/(site)/layout.tsx", "src/app/(site)/page.tsx"];
  for (const file of others) {
    assert.doesNotMatch(read(file), /next\/font/, file);
  }
});

test("the site shell is server-rendered and appears once per route", () => {
  const siteLayout = read("src/app/(site)/layout.tsx");
  assert.match(siteLayout, /<Header \/>/);
  assert.match(siteLayout, /<Footer \/>/);
  assert.match(siteLayout, /id="main"/);
  assert.doesNotMatch(siteLayout, /use client/);

  const rootLayout = read("src/app/layout.tsx");
  assert.doesNotMatch(rootLayout, /use client|usePathname|SiteShell/);
  assert.match(rootLayout, /skip-link/);

  // Root 404 brings its own shell; the group 404 relies on the group layout,
  // so the shell never renders twice.
  assert.match(read("src/app/not-found.tsx"), /<Header \/>/);
  const groupNotFound = read("src/app/(site)/not-found.tsx");
  assert.match(groupNotFound, /NotFoundBody/);
  assert.doesNotMatch(groupNotFound, /<Header \/>|<Footer \/>/);
});

test("homepage metadata is production, not preview", () => {
  const home = read("src/app/(site)/page.tsx");
  assert.match(home, /export const metadata/);
  assert.doesNotMatch(home, /index:\s*false|noindex|Homepage preview/);
  assert.equal((home.match(/<h1/g) || []).length, 0, "the H1 lives in Hero");
  assert.equal(
    (read("src/components/home/HomeSections.tsx").match(/<h1>/g) || []).length,
    1,
  );
});

test("every homepage media reference exists as avif and webp", () => {
  const content = read("src/content/homepage.ts");
  const frames = [
    ...content.matchAll(/base: `\$\{R\}(\/[^`]+)`,\s*widths: \[([^\]]+)\]/g),
  ];
  assert.ok(frames.length >= 17, `found ${frames.length} frames`);
  for (const [, base, widths] of frames) {
    for (const width of widths.split(",").map((w) => w.trim())) {
      for (const ext of ["avif", "webp"]) {
        const file = `public/media/home${base}-${width}.${ext}`;
        assert.equal(existsSync(join(appRoot, file)), true, file);
      }
    }
  }
});

test("no public media path keeps the temporary rescue namespace", () => {
  assert.equal(existsSync(join(appRoot, "public/media/rescue")), false);
  const dirs = readdirSync(join(appRoot, "public/media"));
  // Production media folders only: homepage, portfolio and catalogue.
  for (const dir of dirs) {
    assert.ok(["home", "work", "products", "about"].includes(dir), dir);
  }
  assert.doesNotMatch(read("src/content/homepage.ts"), /media\/rescue/);
});

test("each photograph is used in exactly one homepage slot", () => {
  const content = read("src/content/homepage.ts");
  const bases = [...content.matchAll(/base: `\$\{R\}(\/[^`]+)`/g)].map(
    (m) => m[1],
  );
  assert.equal(new Set(bases).size, bases.length, "a base path is reused");
});

test("Selected work contains only genuine Motion photographs", () => {
  const content = read("src/content/homepage.ts");
  const work = content.slice(
    content.indexOf("export const workLead"),
    content.indexOf("export type Step"),
  );
  const bases = [...work.matchAll(/base: `\$\{R\}(\/[^`]+)`/g)].map(
    (m) => m[1],
  );
  assert.equal(bases.length, 6, "expected six selected-work images");
  for (const base of bases) assert.match(base, /^\/work\//);
  const sources = [...work.matchAll(/source: "(IMG-[^"]+\.jpg)"/g)].map(
    (m) => m[1],
  );
  assert.equal(new Set(sources).size, 6);
  // Stock and presentation mockups must never appear in the gallery.
  assert.doesNotMatch(work, /services\/|process\/|cta\//);
});

test("blocked originals stay off the homepage", () => {
  assert.doesNotMatch(
    read("src/content/homepage.ts"),
    /WA0076|WA0072|WA0150|WA0173|WA0280/,
  );
});

test("the Install step carries no unconfirmed client claim", () => {
  const content = read("src/content/homepage.ts");
  // The permission-pending client storefront was replaced by licensed stock.
  assert.doesNotMatch(content, /WA0228|install-storefront/);
  assert.match(content, /install-panel/);
});

test("public copy carries no builder or permission notes", () => {
  const sections = read("src/components/home/HomeSections.tsx");
  const content = read("src/content/homepage.ts");
  const publicCopy = [
    ...content.matchAll(/(?:title|text|lede|label):\s*"([^"]+)"/g),
  ].map((m) => m[1]);
  for (const line of publicCopy) {
    assert.doesNotMatch(
      line,
      /self-brand|archive|permission|development-only|placeholder|later phase/i,
      line,
    );
  }
  assert.doesNotMatch(
    sections,
    />[^<]*(archive|permission pending|development-only)[^<]*</i,
  );
});

test("the homepage has no Technologies section; header and footer link out", () => {
  // Owner decision OD-03: the section was redundant with the header and footer
  // links, and the Technologies site is advertised on its own.
  const home = read("src/app/(site)/page.tsx");
  const sections = read("src/components/home/HomeSections.tsx");
  assert.doesNotMatch(home, /TechnologiesGateway/);
  assert.doesNotMatch(sections, /TechnologiesGateway|home-tech/);
  assert.doesNotMatch(read("src/styles/home.css"), /home-tech|home-signal/);
  // The link out still exists, from configuration, in the shared shell.
  assert.match(read("src/components/Footer.tsx"), /site\.technologiesUrl/);
  assert.match(read("src/lib/nav.ts"), /site\.technologiesUrl/);
  assert.doesNotMatch(sections, /https?:\/\/(?!localhost)/);
});

test("the Apparel card shows finished branded garments, not a machine or plain stock", () => {
  const content = read("src/content/homepage.ts");
  // Genuine, owner-approved Motion work: printed polo and caps.
  assert.match(content, /apparel-branded/);
  assert.match(content, /IMG-20260921-WA0172\.jpg/);
  assert.doesNotMatch(content, /apparel-garments|folded shirts/);
  assert.doesNotMatch(content, /apparel-embroidery|sewing|embroidery machine/i);
});

test("tags are labels, never styled as buttons", () => {
  const css = read("src/app/globals.css");
  const tagRule = css.slice(
    css.indexOf(".tags li {"),
    css.indexOf("}", css.indexOf(".tags li {")),
  );
  assert.doesNotMatch(tagRule, /border:|background:|padding:/);
});

test("the mobile menu carries the primary action the header hides on phones", () => {
  const nav = read("src/components/MobileNav.tsx");
  assert.match(nav, /Start a Project/);
  assert.match(nav, /href="\/contact"/);
  assert.match(nav, /<nav aria-label="Primary">/);
});
