import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(appRoot, p), "utf8");

const media = JSON.parse(read("src/content/work-media.json"));
const manifest = JSON.parse(read("content/asset-manifest.json"));
const work = read("src/content/work.ts");
const services = read("src/content/services.ts");

test("every portfolio derivative exists in AVIF and WebP", () => {
  for (const [slug, m] of Object.entries(media)) {
    for (const w of m.widths) {
      for (const ext of ["avif", "webp"]) {
        const file = `public/media/work/${slug}-${w}.${ext}`;
        assert.equal(existsSync(join(appRoot, file)), true, file);
      }
    }
    assert.ok(m.width > 0 && m.height > 0, slug);
  }
});

test("portfolio images are genuine Motion photographs, never stock or mockups", () => {
  for (const m of Object.values(media)) {
    assert.match(m.source, /^IMG-2026092[01]-WA\d{4}\.jpg$/);
    const row = manifest.find((r) => r.original_filename === m.source);
    assert.ok(row, m.source);
    assert.equal(row.presentation, "real-work", m.source);
    assert.notEqual(row.tier, "reject-public", m.source);
    assert.notEqual(row.tier, "hold", m.source);
  }
  // Stock and mockup slots from the homepage must never enter the portfolio.
  assert.doesNotMatch(work, /media\/home\/(hero|services|process|cta)\//);
  assert.doesNotMatch(work, /pexels/i);
});

test("only served photographs are approved, each by the owner's recorded decision", () => {
  for (const r of manifest) {
    if (r.permission !== "approved") continue;
    assert.ok(r.public_derivatives.length > 0, r.original_filename);
    assert.equal(r.publication, "launch-approved", r.original_filename);
    assert.match(
      r.public_use_reason,
      /Owner approved publication on 2026-09-23/,
    );
  }
  // Every served photograph is approved: none is still pending.
  for (const r of manifest.filter((x) => x.public_derivatives.length > 0))
    assert.equal(r.permission, "approved", r.original_filename);
  // The four the owner kept off the site stay off it, with the reason.
  for (const name of [
    "IMG-20260920-WA0095.jpg",
    "IMG-20260920-WA0118.jpg",
    "IMG-20260921-WA0060.jpg",
    "IMG-20260921-WA0076.jpg",
  ]) {
    const r = manifest.find((x) => x.original_filename === name);
    assert.deepEqual(r.public_derivatives, [], name);
    assert.equal(r.publication, "not-published", name);
    assert.match(r.public_block_reason, /^Owner review 2026-09-23: /, name);
    assert.ok(!Object.values(media).some((m) => m.source === name), name);
  }
  // Each work-media source records its served derivatives in the manifest.
  for (const [slug, m] of Object.entries(media)) {
    const row = manifest.find((r) => r.original_filename === m.source);
    assert.ok(
      row.public_derivatives.some((f) => f.includes(`/work/${slug}-`)),
      slug,
    );
  }
});

test("launch check passes the photographs but still blocks on configuration", () => {
  const run = spawnSync(process.execPath, ["scripts/launch-check.mjs"], {
    cwd: appRoot,
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /0 pending permission/);
  assert.doesNotMatch(run.stdout, /image IMG-/);
  assert.match(run.stdout, /NEXT_PUBLIC_SITE_URL/);
});

test("every work slug used by a service page exists, and no photo repeats", () => {
  const lists = [...services.matchAll(/work: \[\s*("[^\]]+)\]/g)].map((m) =>
    [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]),
  );
  assert.equal(lists.length, 6);
  const all = lists.flat();
  assert.equal(
    new Set(all).size,
    all.length,
    "a photo repeats across services",
  );
  for (const slug of all) {
    assert.match(work, new RegExp(`"${slug}"`), slug);
  }
});

test("service copy makes no price, turnaround or guarantee claims", () => {
  const copy = services.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(
    copy,
    /UGX|USH|\$\d|price from|same[- ]day|24 ?hours|guarantee|fastest|cheapest|best in/i,
  );
});

test("collections group at least two genuine pieces each", () => {
  const slugs = [...work.matchAll(/slug: "([a-z-]+)",\n\s+name:/g)].map(
    (m) => m[1],
  );
  assert.equal(slugs.length, 6);
  for (const slug of slugs) {
    const count = work.split(`collection: "${slug}"`).length - 1;
    assert.ok(count >= 2, `${slug} has ${count}`);
  }
});

test("service and work routes are complete, not placeholders", () => {
  for (const file of [
    "src/app/(site)/services/page.tsx",
    "src/app/(site)/services/[slug]/page.tsx",
    "src/app/(site)/work/page.tsx",
    "src/app/(site)/work/[slug]/page.tsx",
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /placeholder|later phase/i, file);
    assert.match(source, /Breadcrumbs/, file);
  }
  const detail = read("src/app/(site)/services/[slug]/page.tsx");
  assert.match(detail, /dynamicParams = false/);
  assert.match(detail, /openGraph/);
});

test("work filters are links with a current state and an empty state", () => {
  const page = read("src/app/(site)/work/page.tsx");
  assert.match(page, /aria-current=\{current \? "page" : undefined\}/);
  assert.match(page, /\/work\?category=/);
  assert.match(page, /work-empty/);
  assert.match(page, /role="status"/);
  // Fixed-ratio tiles: no masonry, no layout shift.
  assert.match(
    read("src/styles/pages.css"),
    /\.work-tile__frame \{\s+aspect-ratio/,
  );
});
