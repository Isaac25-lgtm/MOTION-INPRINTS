import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("technologies env example uses local development defaults only", () => {
  const example = readFileSync(join(appRoot, ".env.example"), "utf8");
  assert.match(example, /NEXT_PUBLIC_SITE_URL=http:\/\/localhost:3001/);
  assert.match(example, /NEXT_PUBLIC_PARENT_URL=http:\/\/localhost:3000/);
  assert.doesNotMatch(example, /https:\/\//);
});

test("technologies package exposes independent scripts", () => {
  const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  assert.equal(pkg.name, "motion-technologies");
  for (const script of ["dev", "build", "start", "lint", "typecheck", "test"]) {
    assert.ok(pkg.scripts[script], `missing script: ${script}`);
  }
});

test("technologies site config centralizes the parent destination", () => {
  const source = readFileSync(join(appRoot, "src/lib/site.ts"), "utf8");
  assert.match(source, /NEXT_PUBLIC_PARENT_URL/);
  assert.match(source, /localhost:3000/);
});

test("the homepage states the parent relationship and links back", () => {
  const home = readFileSync(join(appRoot, "src/app/(site)/page.tsx"), "utf8");
  const header = readFileSync(
    join(appRoot, "src/components/Header.tsx"),
    "utf8",
  );
  assert.match(home, /technology division of \{site\.parentName\}/);
  assert.match(home, /site\.parentUrl/);
  assert.match(header, /site\.parentUrl/);
});
