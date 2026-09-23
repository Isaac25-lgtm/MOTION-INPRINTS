import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("parent env example uses local development defaults only", () => {
  const example = readFileSync(join(appRoot, ".env.example"), "utf8");
  assert.match(example, /NEXT_PUBLIC_SITE_URL=http:\/\/localhost:3000/);
  assert.match(example, /NEXT_PUBLIC_TECHNOLOGIES_URL=http:\/\/localhost:3001/);
  assert.doesNotMatch(example, /https:\/\//);
});

test("parent package exposes independent scripts", () => {
  const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  assert.equal(pkg.name, "motion-imprints");
  for (const script of ["dev", "build", "start", "lint", "typecheck", "test"]) {
    assert.ok(pkg.scripts[script], `missing script: ${script}`);
  }
});

test("parent site config centralizes the Technologies destination", () => {
  const source = readFileSync(join(appRoot, "src/lib/site.ts"), "utf8");
  assert.match(source, /NEXT_PUBLIC_TECHNOLOGIES_URL/);
  assert.match(source, /localhost:3001/);
});

test("primary navigation treats Technologies as an external configured URL", () => {
  const source = readFileSync(join(appRoot, "src/lib/nav.ts"), "utf8");
  assert.match(source, /site\.technologiesUrl/);
  assert.doesNotMatch(source, /href: "\/technologies"/);
});

test("parent design tokens keep the sampled logo blue and an accessible text blue", () => {
  const tokens = readFileSync(join(appRoot, "src/styles/tokens.css"), "utf8");
  // Sampled from the supplied logo across ~180k pixels: this one is fixed.
  assert.match(tokens, /--motion-blue:\s*#2c9de3/i);

  // Small blue text on paper needs 4.5:1, which the logo blue does not reach
  // (2.72:1), so a darker text blue is required. The exact value may be tuned;
  // the contrast requirement may not. Measured here rather than hardcoded.
  const textBlue = tokens.match(/--motion-blue-text:\s*(#[0-9a-f]{6})/i);
  assert.ok(textBlue, "--motion-blue-text must be defined");
  const paper = tokens.match(/--paper:\s*(#[0-9a-f]{6})/i);
  assert.ok(paper, "--paper must be defined");

  const channel = (hex, i) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  const lum = (hex) =>
    [0.2126, 0.7152, 0.0722].reduce((total, weight, i) => {
      const c = channel(hex, i);
      return (
        total +
        weight * (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      );
    }, 0);
  const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const ratio = contrast(textBlue[1], paper[1]);
  assert.ok(
    ratio >= 4.5,
    `--motion-blue-text ${textBlue[1]} on ${paper[1]} is ${ratio.toFixed(2)}:1, below 4.5:1`,
  );
  assert.match(tokens, /prefers-reduced-motion/);
});

test("logo web derivatives exist for the parent site", () => {
  // logo.png is the extraction from the supplied PDF; logo-trim.png is the same
  // artwork with its transparent padding cropped, used in the header and footer.
  assert.equal(existsSync(join(appRoot, "public/brand/logo.png")), true);
  assert.equal(existsSync(join(appRoot, "public/brand/logo-trim.png")), true);
});

test("the homepage composes the approved sections from shared content", () => {
  const home = readFileSync(join(appRoot, "src/app/(site)/page.tsx"), "utf8");
  const sections = readFileSync(
    join(appRoot, "src/components/home/HomeSections.tsx"),
    "utf8",
  );
  for (const section of [
    "<Hero />",
    "<CapabilityRail />",
    "<ServiceGrid />",
    "<FeaturedProject />",
    "<SelectedWork />",
    "<ProcessSteps />",
    "<ClosingCta />",
  ]) {
    assert.equal(home.includes(section), true, section);
  }
  // The rail names the capabilities once for assistive technology: the moving
  // track is hidden and the static list carries them.
  assert.match(sections, /visually-hidden/);
  assert.match(sections, /aria-hidden="true"/);
  assert.equal(existsSync(join(appRoot, "src/app/favicon.ico")), true);
  assert.equal(existsSync(join(appRoot, "src/app/icon.png")), true);
});

test("asset manifest covers 173 originals and excludes reject-public from the site bundle", () => {
  const manifest = JSON.parse(
    readFileSync(join(appRoot, "content/asset-manifest.json"), "utf8"),
  );
  assert.equal(manifest.length, 173);
  const rejected = manifest.filter((row) => row.tier === "reject-public");
  assert.equal(rejected.length, 5);
  for (const row of rejected) {
    assert.deepEqual(row.public_derivatives, []);
    assert.equal(row.publication, "reject-public");
  }
  const removed = [
    "IMG-20260920-WA0076.jpg",
    "IMG-20260920-WA0072.jpg",
    "IMG-20260921-WA0150.jpg",
    "IMG-20260921-WA0173.jpg",
  ];
  for (const name of removed) {
    const row = manifest.find((item) => item.original_filename === name);
    assert.ok(row, name);
    assert.deepEqual(row.public_derivatives, []);
    assert.notEqual(row.permission, "approved");
    assert.notEqual(row.publication, "launch-approved");
    assert.ok(row.public_block_reason);
  }
  for (const row of manifest) {
    assert.ok(row.orientation_review);
    assert.notEqual(row.orientation_review, "none-assumed");
    assert.notEqual(row.rotation, "none-assumed");
    assert.notEqual(row.permission, "approved");
    assert.notEqual(row.publication, "launch-approved");
    assert.ok(row.presentation);
    assert.ok(row.publication);
    assert.ok(row.derivative_transform);
  }
  const halo = manifest.find(
    (item) => item.original_filename === "IMG-20260921-WA0150.jpg",
  );
  assert.equal(halo.orientation_review, "mirror-horizontal-needs-confirmation");
  // The rejected homepage's derivatives were deleted with it.
  assert.equal(
    existsSync(join(appRoot, "public/media/homepage")),
    false,
    "public/media/homepage should be removed",
  );
  // Every row that still serves the site points at the production media path.
  for (const row of manifest) {
    for (const file of row.public_derivatives) {
      assert.match(file, /^public\/media\/(home|work|products|about)\//, file);
      assert.equal(existsSync(join(appRoot, file)), true, file);
    }
  }
});
