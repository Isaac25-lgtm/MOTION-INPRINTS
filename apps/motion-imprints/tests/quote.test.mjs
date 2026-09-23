// Quote list, validation, references, rate limiting and persistence.
// The modules under test are pure TypeScript, loaded through Node's type
// stripping, so these tests exercise the real code without a build.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CART_KEY,
  MAX_LINES,
  addLine,
  clampQuantity,
  parseStored,
  removeLine,
  updateLine,
} from "../src/lib/quote/cart.ts";
import { validateInquiry, validateQuote } from "../src/lib/quote/validate.ts";
import {
  REFERENCE_PATTERN,
  makeReference,
} from "../src/lib/quote/reference.ts";
import { createRateLimiter } from "../src/lib/quote/rate-limit.ts";
import { createRepository } from "../src/lib/quote/repository.ts";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(appRoot, p), "utf8");

let n = 0;
const makeId = () => `id-${++n}`;
const line = (over = {}) => ({
  slug: "business-cards",
  title: "Business cards",
  unit: "cards",
  options: { sides: "Double-sided" },
  quantity: 100,
  notes: "",
  ...over,
});

const catalogue = {
  "business-cards": {
    title: "Business cards",
    unit: "cards",
    options: [
      {
        id: "sides",
        label: "Printed sides",
        choices: ["Single-sided", "Double-sided"],
      },
      {
        id: "finish",
        label: "Finish",
        choices: ["Matt lamination", "Gloss lamination"],
      },
    ],
  },
};
const lookup = (slug) => catalogue[slug] ?? null;

const validBody = (over = {}) => ({
  name: "Amina N.",
  organisation: "",
  phone: "+256 700 123456",
  whatsappSame: true,
  email: "",
  location: "Kampala",
  deadline: "",
  notes: "",
  consent: true,
  website: "",
  items: [
    {
      slug: "business-cards",
      options: { sides: "Double-sided" },
      quantity: 200,
      notes: "",
    },
  ],
  source: { path: "/products/business-cards", utmSource: "facebook" },
  ...over,
});

/* ------------------------------------------------------------------ cart */

test("cart adds, merges identical lines, updates, removes and clears", () => {
  let lines = addLine([], line(), makeId);
  assert.equal(lines.length, 1);
  lines = addLine(lines, line({ quantity: 50 }), makeId);
  assert.equal(lines.length, 1, "identical choice merges");
  assert.equal(lines[0].quantity, 150);
  lines = addLine(lines, line({ options: { sides: "Single-sided" } }), makeId);
  assert.equal(lines.length, 2, "different options stay separate");
  lines = updateLine(lines, lines[1].id, {
    quantity: 0,
    notes: "Rounded corners",
  });
  assert.equal(lines[1].quantity, 1, "quantity floors at 1");
  assert.equal(lines[1].notes, "Rounded corners");
  lines = removeLine(lines, lines[0].id);
  assert.equal(lines.length, 1);
});

test("cart caps lines and quantities", () => {
  let lines = [];
  for (let i = 0; i < MAX_LINES + 5; i++)
    lines = addLine(lines, line({ notes: `n${i}` }), makeId);
  assert.equal(lines.length, MAX_LINES);
  assert.equal(clampQuantity(1e9), 100000);
  assert.equal(clampQuantity("abc"), 1);
  assert.equal(clampQuantity(2.9), 2);
});

test("stored cart survives a refresh and drops malformed entries", () => {
  const lines = addLine([], line(), makeId);
  const restored = parseStored(JSON.stringify([...lines, { junk: true }, 7]));
  assert.deepEqual(restored, lines);
  assert.deepEqual(parseStored("not json"), []);
  assert.deepEqual(parseStored(null), []);
  assert.equal(CART_KEY, "motion-quote-v1");
});

test("the stored cart never contains contact details", () => {
  const cart = read("src/lib/quote/cart.ts");
  const typeBlock = cart.slice(
    cart.indexOf("export type CartLine"),
    cart.indexOf("export type NewLine"),
  );
  for (const field of ["name", "phone", "email", "whatsapp", "location"])
    assert.doesNotMatch(typeBlock, new RegExp(`\\b${field}\\b`), field);
  // The builder keeps the details form in React state, not storage.
  const builder = read("src/components/quote/QuoteBuilder.tsx");
  assert.doesNotMatch(builder, /localStorage|sessionStorage/);
});

/* ------------------------------------------------------------ validation */

test("a valid quote is re-snapshotted from the catalogue", () => {
  const r = validateQuote(
    validBody({
      items: [
        {
          slug: "business-cards",
          title: "TAMPERED",
          options: { sides: "Double-sided" },
          quantity: 200,
          notes: " x ",
        },
      ],
    }),
    lookup,
  );
  assert.equal(r.ok, true);
  const item = r.value.items[0];
  assert.equal(item.title, "Business cards", "title comes from the catalogue");
  assert.deepEqual(item.options, [
    { label: "Printed sides", choice: "Double-sided" },
    { label: "Finish", choice: "Not specified" },
  ]);
  assert.equal(item.notes, "x");
  assert.equal(r.value.contact.whatsapp, "+256 700 123456");
  assert.equal(r.value.source.utmSource, "facebook");
});

test("the server rejects malformed and incomplete requests", () => {
  const cases = [
    [validBody({ name: "" }), "name"],
    [validBody({ phone: "call me" }), "phone"],
    [validBody({ location: "" }), "location"],
    [validBody({ consent: false }), "consent"],
    [validBody({ email: "not-an-email" }), "email"],
    [validBody({ items: [] }), "items"],
    [validBody({ deadline: "2001-01-01" }), "deadline"],
    [validBody({ items: [{ slug: "nope", quantity: 1 }] }), "items.0"],
    [
      validBody({ items: [{ slug: "business-cards", quantity: 1.5 }] }),
      "items.0",
    ],
    [
      validBody({
        items: [
          { slug: "business-cards", quantity: 1, options: { sides: "Triple" } },
        ],
      }),
      "items.0",
    ],
  ];
  for (const [body, field] of cases) {
    const r = validateQuote(body, lookup);
    assert.equal(r.ok, false, field);
    assert.ok(r.errors[field], `expected error on ${field}`);
  }
  assert.equal(validateQuote("text", lookup).ok, false);
  assert.equal(validateQuote(null, lookup).ok, false);
});

test("the honeypot marks automated submissions as spam", () => {
  const r = validateQuote(
    validBody({ website: "http://spam.example" }),
    lookup,
  );
  assert.equal(r.ok, false);
  assert.equal(r.spam, true);
});

test("inquiries need a message; location is optional", () => {
  const base = {
    name: "Amina",
    phone: "+256700123456",
    consent: true,
    message: "We need signage for a new shop.",
  };
  assert.equal(validateInquiry(base).ok, true);
  assert.equal(validateInquiry({ ...base, message: "hi" }).ok, false);
  assert.equal(
    validateInquiry({ ...base, topic: "evil" }).value.topic,
    "general",
  );
});

/* ------------------------------------------------- references and limits */

test("references are human-readable and unambiguous", () => {
  const ref = makeReference(
    "Q",
    new Date("2026-09-23T10:00:00Z"),
    () => new Uint8Array([0, 1, 2, 31, 30]),
  );
  assert.equal(ref, "MI-Q-260923-012ZY");
  assert.match(ref, REFERENCE_PATTERN);
  for (let i = 0; i < 200; i++) {
    const r = makeReference("M");
    assert.match(r, REFERENCE_PATTERN);
    assert.doesNotMatch(r.slice(-5), /[ILOU]/);
  }
});

test("rate limiter allows a burst then blocks until the window passes", () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
  assert.deepEqual(
    [1, 2, 3, 4].map(() => limiter.check("a", 0)),
    [true, true, true, false],
  );
  assert.equal(limiter.check("b", 0), true, "keys are independent");
  assert.equal(limiter.check("a", 1000), true, "window resets");
});

/* ----------------------------------------------------------- persistence */

function fakeDb({ failItemInsert = false, collideTimes = 0 } = {}) {
  const log = [];
  let collisions = collideTimes;
  let nextId = 41;
  const connect = async () => ({
    async query(sql) {
      log.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
      if (
        /^INSERT INTO orders/.test(sql.trim()) ||
        /^INSERT INTO inquiries/.test(sql.trim())
      ) {
        if (collisions > 0) {
          collisions--;
          const e = new Error("duplicate reference");
          e.code = "23505";
          throw e;
        }
        return { rows: [{ id: ++nextId }] };
      }
      if (/^INSERT INTO order_items/.test(sql.trim()) && failItemInsert)
        throw Object.assign(new Error("boom"), { code: "XX000" });
      return { rows: [] };
    },
    release() {
      log.push("RELEASE");
    },
  });
  return { connect, log };
}

const request = () => validateQuote(validBody(), lookup).value;

test("an order and its items are written in one transaction", async () => {
  const db = fakeDb();
  const repo = createRepository(db.connect, () => "MI-Q-260923-AAAAA");
  const saved = await repo.saveQuote(request());
  assert.equal(saved.reference, "MI-Q-260923-AAAAA");
  assert.deepEqual(db.log, [
    "BEGIN",
    "INSERT INTO orders",
    "INSERT INTO order_items",
    "COMMIT",
    "RELEASE",
  ]);
});

test("a failed item insert rolls the whole order back", async () => {
  const db = fakeDb({ failItemInsert: true });
  const repo = createRepository(db.connect, () => "MI-Q-260923-AAAAA");
  await assert.rejects(repo.saveQuote(request()));
  assert.ok(db.log.includes("ROLLBACK"));
  assert.ok(!db.log.includes("COMMIT"));
  assert.equal(db.log.at(-1), "RELEASE");
});

test("a reference collision retries with a new reference", async () => {
  const db = fakeDb({ collideTimes: 2 });
  let i = 0;
  const repo = createRepository(db.connect, () => `MI-Q-260923-AAAA${++i}`);
  const saved = await repo.saveQuote(request());
  assert.equal(saved.reference, "MI-Q-260923-AAAA3");
});

/* ------------------------------------------------------- route contract */

test("the quote route validates, stores, then notifies, and fails safely", () => {
  const route = read("src/app/api/quote/route.ts");
  const order = [
    "guard(",
    "validateQuote(",
    "getRepository()",
    "saveQuote(",
    "notify(",
  ].map((s) => route.indexOf(s));
  assert.ok(
    order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])),
    "order of operations",
  );
  assert.match(route, /json\(503/, "missing database answers 503");
  assert.match(
    route,
    /json\(201, \{ reference/,
    "reference only after a write",
  );
  const server = read("src/lib/server/submissions.ts");
  assert.match(server, /MAX_BODY_BYTES/);
  assert.match(server, /origin/);
  assert.match(
    server,
    /NODE_ENV !== "production"/,
    "memory store is development-only",
  );
  // Logs carry no request body.
  assert.doesNotMatch(
    route,
    /logEvent\([^)]*(contact|result\.value|checked\.body)/,
  );
});

test("the migration creates the handoff's tables with snapshots and no payment data", () => {
  const sql = read("../../db/migrations/001_submissions.sql");
  for (const t of [
    "orders",
    "order_items",
    "inquiries",
    "feedback",
    "chat_leads",
  ])
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${t} `), t);
  assert.match(sql, /reference\s+TEXT NOT NULL UNIQUE/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.doesNotMatch(sql, /card_number|cvv|payment_token/i);
});

test("an assistant handoff stores only the approved summary in chat_leads", async () => {
  const calls = [];
  const connect = async () => ({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [{ id: 3 }] };
    },
    release() {},
  });
  const repo = createRepository(connect, () => "MI-A-260923-AAAAA");
  const saved = await repo.saveHandoff({
    summary: "Need 200 polo shirts",
    name: "Grace",
    phone: "+256700123456",
    email: "",
    sourcePath: "/products/polo-shirts",
  });
  assert.equal(saved.reference, "MI-A-260923-AAAAA");
  assert.match(calls[0].sql, /INSERT INTO chat_leads/);
  assert.match(calls[0].sql, /'imprints'/);
  assert.equal(calls[0].values.length, 6);
});
