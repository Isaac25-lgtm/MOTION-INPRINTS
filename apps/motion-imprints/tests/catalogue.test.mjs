import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(appRoot, p), "utf8");

const catalogue = read("src/content/catalogue.ts");
const productMedia = JSON.parse(read("src/content/product-media.json"));
const workMedia = JSON.parse(read("src/content/work-media.json"));
const work = read("src/content/work.ts");
const manifest = JSON.parse(read("content/asset-manifest.json"));

const blocks = catalogue.split("product({").slice(1);

test("the catalogue is typed, sizeable and has unique slugs", () => {
  assert.match(catalogue, /export type Product = \{/);
  const slugs = blocks.map((b) => b.match(/slug: "([a-z0-9-]+)"/)[1]);
  assert.ok(slugs.length >= 30, `${slugs.length} products`);
  assert.equal(new Set(slugs).size, slugs.length);
  const categories = [...catalogue.matchAll(/id: "([a-z]+)",\n\s+label:/g)].map(
    (m) => m[1],
  );
  for (const b of blocks) {
    const cat = b.match(/category: "([a-z]+)"/)[1];
    assert.ok(categories.includes(cat), cat);
    assert.match(b, /options: \[/);
    assert.match(b, /unit: "[a-z]+"/);
    assert.match(
      b,
      /service: "(design|printing|branding|signage|packaging|corporate)"/,
    );
  }
});

test("every product is priced on quotation; no price, stock or urgency is invented", () => {
  assert.match(catalogue, /pricing: "quote"/);
  assert.doesNotMatch(catalogue, /pricing: "fixed"|price: \d|UGX|USh|shs/i);
  const copy = catalogue.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(
    copy,
    /in stock|only \d+ left|limited time|hurry|sale|discount|minimum order|delivered in \d|same[- ]day|\bfree\b/i,
  );
  const pages = [
    "src/app/(site)/products/page.tsx",
    "src/app/(site)/products/[slug]/page.tsx",
    "src/components/quote/ProductCard.tsx",
  ].map(read);
  for (const p of pages)
    assert.doesNotMatch(p, /checkout|pay now|card payment/i);
  assert.match(pages[2], /Priced on quotation/);
});

test("every product image is a built genuine derivative", () => {
  for (const m of catalogue.matchAll(/productImage\(\s*"([a-z0-9-]+)"/g)) {
    const media = productMedia[m[1]];
    assert.ok(media, `product media ${m[1]}`);
    for (const w of media.widths)
      for (const ext of ["avif", "webp"])
        assert.ok(
          existsSync(
            join(appRoot, `public/media/products/${m[1]}-${w}.${ext}`),
          ),
          `${m[1]}-${w}.${ext}`,
        );
    const row = manifest.find((r) => r.original_filename === media.source);
    assert.equal(row.presentation, "real-work");
    assert.notEqual(row.tier, "hold");
    assert.notEqual(row.tier, "reject-public");
  }
  for (const m of catalogue.matchAll(/workImage\("([a-z0-9-]+)"\)/g)) {
    assert.ok(
      workMedia[m[1]] || work.includes(`shared("${m[1]}"`),
      `work image ${m[1]}`,
    );
  }
});

test("product routes are statically generated and unknown slugs 404", () => {
  const page = read("src/app/(site)/products/[slug]/page.tsx");
  assert.match(page, /generateStaticParams/);
  assert.match(page, /dynamicParams = false/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /<AddToQuote/);
  assert.match(page, /\/contact\?product=/, "direct inquiry fallback");
  assert.match(page, /openGraph/);
});

test("contact channels render only when configured", () => {
  const contact = read("src/lib/contact.ts");
  assert.match(contact, /NEXT_PUBLIC_CONTACT_PHONE/);
  assert.doesNotMatch(
    contact,
    /\+256\s?\d|07\d{8}|@motion/i,
    "no invented values",
  );
  const page = read("src/app/(site)/products/[slug]/page.tsx");
  assert.match(page, /contact\.whatsapp \?/);
});
