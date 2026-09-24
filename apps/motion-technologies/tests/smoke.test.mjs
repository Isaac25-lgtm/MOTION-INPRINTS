import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("technologies env example uses local development defaults only", () => {
  const example = readFileSync(join(appRoot, ".env.example"), "utf8");
  assert.match(example, /NEXT_PUBLIC_SITE_URL=http:\/\/localhost:3001/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_PARENT_URL/);
  assert.doesNotMatch(example, /https:\/\//);
});

test("technologies package exposes independent scripts", () => {
  const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  assert.equal(pkg.name, "motion-technologies");
  for (const script of ["dev", "build", "start", "lint", "typecheck", "test"]) {
    assert.ok(pkg.scripts[script], `missing script: ${script}`);
  }
});

test("the Technologies site stands on its own (OD-07)", () => {
  const source = readFileSync(join(appRoot, "src/lib/site.ts"), "utf8");
  assert.match(source, /name: "Motion Imprints Technologies"/);
  assert.doesNotMatch(
    source,
    /parentName|parentUrl|relationship|NEXT_PUBLIC_PARENT_URL/,
  );
  // No page, component or assistant prompt presents it as a division or
  // links back to a parent company.
  const files = [
    "src/app/(site)/page.tsx",
    "src/app/(site)/about/page.tsx",
    "src/app/(site)/contact/page.tsx",
    "src/components/Header.tsx",
    "src/components/MobileNav.tsx",
    "src/components/Footer.tsx",
    "src/content/solutions.ts",
    "src/lib/assistant/knowledge.ts",
  ];
  for (const f of files) {
    const text = readFileSync(join(appRoot, f), "utf8");
    assert.doesNotMatch(
      text,
      /division of|parent company|Parent company|parentOrganization|site\.parent/,
      f,
    );
  }
});

test("fonts ship with the site, so a build never depends on Google Fonts", () => {
  const layout = readFileSync(join(appRoot, "src/app/layout.tsx"), "utf8");
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(layout, /next\/font\/local/);
  for (const m of layout.matchAll(
    /src: "\.\.\/fonts\/([A-Za-z]+)-latin\.woff2"/g,
  )) {
    assert.ok(existsSync(join(appRoot, `src/fonts/${m[1]}-latin.woff2`)), m[1]);
    // SIL Open Font License travels with each bundled font.
    assert.ok(
      existsSync(join(appRoot, `src/fonts/${m[1]}-OFL.txt`)),
      `${m[1]} licence`,
    );
  }
});
