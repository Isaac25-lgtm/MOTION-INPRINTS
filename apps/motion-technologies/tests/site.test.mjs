// Technologies content, truthfulness, leads and persistence.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateLead } from "../src/lib/leads/validate.ts";
import {
  REFERENCE_PATTERN,
  makeReference,
} from "../src/lib/leads/reference.ts";
import { createLeadRepository } from "../src/lib/leads/repository.ts";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(appRoot, p), "utf8");
const solutionsSrc = read("src/content/solutions.ts");
const slugs = [...solutionsSrc.matchAll(/^    slug: "([a-z-]+)",$/gm)].map(
  (m) => m[1],
);

test("ten solution families, including Digital Marketing (OD-01)", () => {
  assert.equal(slugs.length, 10);
  for (const s of [
    "health",
    "monitoring-evaluation",
    "business",
    "sacco",
    "education",
    "pos-retail",
    "websites",
    "digital-marketing",
    "analytics",
    "custom-software",
  ])
    assert.ok(slugs.includes(s), s);
  assert.match(solutionsSrc, /OD-01/);
  assert.match(solutionsSrc, /newly established businesses/);
});

test("every solution has its own visual and a varied composition", () => {
  const visuals = [...solutionsSrc.matchAll(/visual: "([a-z]+)"/g)].map(
    (m) => m[1],
  );
  assert.equal(
    new Set(visuals).size,
    10,
    "each solution has a distinct visual",
  );
  const kinds = solutionsSrc
    .split(/\n  \{\n    slug:/)
    .slice(1)
    .map((b) =>
      [...b.matchAll(/kind: "([a-z]+)"/g)].map((m) => m[1]).join(","),
    );
  assert.ok(
    new Set(kinds).size >= 6,
    `only ${new Set(kinds).size} distinct block sequences`,
  );
  const related = [...solutionsSrc.matchAll(/related: \[([^\]]+)\]/g)].flatMap(
    (m) => [...m[1].matchAll(/"([a-z-]+)"/g)].map((x) => x[1]),
  );
  for (const r of related) assert.ok(slugs.includes(r), `unknown related ${r}`);
});

test("no invented clients, certifications, access claims or results", () => {
  const copy = [
    solutionsSrc,
    read("src/app/(site)/page.tsx"),
    read("src/app/(site)/capabilities/integrations/page.tsx"),
    read("src/app/(site)/capabilities/security/page.tsx"),
    read("src/app/(site)/about/page.tsx"),
    read("src/app/(site)/work/page.tsx"),
  ]
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(
    copy,
    /\b(ISO|SOC)[ -]?\d|HIPAA compliant|certified by|approved by the Ministry/i,
  );
  assert.doesNotMatch(
    copy,
    /trusted by|our clients include|\d+\+ (clients|facilities|schools)|we guarantee/i,
  );
  assert.doesNotMatch(copy, /\b\d{2,3}% (faster|increase|reduction|growth)/i);
  // National systems only where authorised.
  for (const m of copy.matchAll(/DHIS2[^.\n]*/g)) {
    const around = copy.slice(Math.max(0, m.index - 200), m.index + 300);
    assert.match(around, /authoris|where required|reporting formats/i, m[0]);
  }
});

test("device mockups carry our screens and say the data is invented", () => {
  const media = JSON.parse(read("src/content/tech-media.json"));
  const devices = Object.entries(media.devices);
  assert.ok(devices.length >= 10);
  for (const [slug, d] of devices) {
    assert.match(d.alt, /sample (data|content)/, slug);
    for (const w of d.widths)
      for (const ext of ["avif", "webp"])
        assert.ok(
          existsSync(join(appRoot, `public${d.base}-${w}.${ext}`)),
          `${slug}-${w}.${ext}`,
        );
  }
  const home = read("src/app/(site)/page.tsx");
  assert.match(home, /invented sample data/);
  const footer = read("src/components/Footer.tsx");
  assert.match(footer, /invented sample data/);
  // The screen designs themselves use invented identifiers, never names.
  const mock = read("src/components/ui/Mockups.tsx");
  assert.doesNotMatch(mock, /Patient:? [A-Z][a-z]+ [A-Z][a-z]+/);
  assert.match(mock, /P-0412/);
});

test("the hero video is light, muted, looped and can be paused", () => {
  const media = JSON.parse(read("src/content/tech-media.json"));
  for (const v of Object.values(media.videos)) {
    assert.ok(existsSync(join(appRoot, `public${v.src}`)), v.src);
    assert.ok(v.bytes < 2_500_000, `${v.src} is ${v.bytes} bytes`);
  }
  const hero = read("src/components/media/HeroVideo.tsx");
  assert.match(hero, /muted/);
  assert.match(hero, /loop/);
  assert.match(hero, /playsInline/);
  assert.match(hero, /prefers-reduced-motion/);
  assert.match(hero, /Pause background video/);
});

test("the capture page never ships in production", () => {
  const screens = read("src/app/screens/page.tsx");
  assert.match(screens, /NODE_ENV === "production"\) notFound\(\)/);
});

test("work items are labelled with their real status", () => {
  const work = read("src/app/(site)/work/page.tsx");
  assert.match(work, /status: "Concept demonstration"/);
  assert.doesNotMatch(
    work,
    /status: "Client project"/,
    "no client work without permission",
  );
});

test("every solution route is statically generated and unknown slugs 404", () => {
  const page = read("src/app/(site)/solutions/[slug]/page.tsx");
  assert.match(page, /generateStaticParams/);
  assert.match(page, /dynamicParams = false/);
  assert.match(
    page,
    /\/contact\?solution=/,
    "solution context carried to the form",
  );
});

test("the Technologies lockup keeps the supplied wordmark and never isolates the mark", () => {
  // Supplied "Motion i" wordmark with SYSTEMS . DATA . DIGITAL in place of the
  // print tagline (OD-07); the parent keeps DESIGN . PRINT . BRAND.
  assert.equal(
    existsSync(join(appRoot, "public/brand/logo-technologies.png")),
    true,
  );
  assert.match(read("src/components/Brand.tsx"), /logo-technologies\.png/);
  assert.match(read("src/components/Footer.tsx"), /logo-technologies\.png/);
  assert.equal(existsSync(join(appRoot, "public/brand/logo-trim.png")), false);
  assert.equal(
    readdirSync(join(appRoot, "public/brand")).some((f) =>
      /mark|icon-i/i.test(f),
    ),
    false,
  );
});

/* ----------------------------------------------------------------- leads */

const valid = (over = {}) => ({
  name: "Grace A.",
  organisation: "Sample Health Centre",
  phone: "+256 700 123456",
  whatsappSame: true,
  message: "We want to move outpatient registration off paper.",
  consent: true,
  website: "",
  solution: "health",
  requestType: "demo",
  timeline: "within-3-months",
  ...over,
});

test("a valid lead keeps its solution context", () => {
  const r = validateLead(valid(), slugs);
  assert.equal(r.ok, true);
  assert.equal(r.value.solution, "health");
  assert.equal(r.value.requestType, "demo");
  assert.equal(r.value.whatsapp, "+256 700 123456");
});

test("unknown solution, type or timeline fall back safely", () => {
  const r = validateLead(
    valid({ solution: "evil", requestType: "x", timeline: "y" }),
    slugs,
  );
  assert.equal(r.value.solution, "general");
  assert.equal(r.value.requestType, "discuss");
  assert.equal(r.value.timeline, "");
});

test("the server rejects incomplete leads and flags the honeypot", () => {
  for (const [over, field] of [
    [{ name: "" }, "name"],
    [{ organisation: "" }, "organisation"],
    [{ phone: "nope" }, "phone"],
    [{ message: "hi" }, "message"],
    [{ consent: false }, "consent"],
    [{ email: "bad@" }, "email"],
  ]) {
    const r = validateLead(valid(over), slugs);
    assert.equal(r.ok, false, field);
    assert.ok(r.errors[field], field);
  }
  const spam = validateLead(valid({ website: "x" }), slugs);
  assert.equal(spam.spam, true);
});

test("Technologies references are distinct from the parent's", () => {
  const ref = makeReference("T");
  assert.match(ref, REFERENCE_PATTERN);
  assert.match(ref, /^MI-T-/);
});

test("a lead is stored in the shared inquiries table with site and context", async () => {
  const calls = [];
  const connect = async () => ({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [{ id: 7 }] };
    },
    release() {},
  });
  const repo = createLeadRepository(connect, () => "MI-T-260923-AAAAA");
  const lead = validateLead(valid(), slugs).value;
  const saved = await repo.saveLead(lead);
  assert.equal(saved.reference, "MI-T-260923-AAAAA");
  assert.match(calls[0].sql, /INSERT INTO inquiries/);
  assert.match(calls[0].sql, /'technologies'/);
  assert.deepEqual(JSON.parse(calls[0].values[10]), {
    role: "",
    requestType: "demo",
    timeline: "within-3-months",
  });
});

test("the inquiry route fails safely and logs no form contents", () => {
  const route = read("src/app/api/inquiry/route.ts");
  assert.match(route, /json\(503/);
  assert.match(route, /json\(201, \{ reference/);
  assert.doesNotMatch(
    route,
    /logEvent\([^)]*(lead\.(name|phone|email|message|organisation)|result\.value|checked\.body)/,
  );
  const server = read("src/lib/server/submissions.ts");
  assert.match(server, /NODE_ENV !== "production"/);
});
