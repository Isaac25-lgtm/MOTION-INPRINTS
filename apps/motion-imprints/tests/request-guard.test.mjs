// Hostile-input handling in the shared request guard: a malformed Origin is
// refused (never a 500) and the body limit is a strict byte limit, enforced
// while the body streams in.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  isForeignOrigin,
  readLimitedBody,
} from "../src/lib/server/request-body.ts";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(appRoot, p), "utf8");

/** A POST whose body streams in chunks, with no Content-Length. */
function streamed(chunks, pulled = { count: 0 }) {
  let i = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) return controller.close();
      pulled.count++;
      controller.enqueue(chunks[i++]);
    },
  });
  return new Request("http://localhost/api/x", {
    method: "POST",
    body,
    duplex: "half",
  });
}

test("a malformed Origin is treated as foreign instead of throwing", () => {
  for (const origin of ["null", "not a url", "http://[bad", "://", " "])
    assert.equal(isForeignOrigin(origin, "localhost:3000"), true, origin);
  assert.equal(
    isForeignOrigin("http://localhost:3000", "localhost:3000"),
    false,
  );
  assert.equal(isForeignOrigin("https://evil.example", "localhost:3000"), true);
  assert.equal(isForeignOrigin(null, "localhost:3000"), false);
});

test("reading stops as soon as a streamed body passes the byte limit", async () => {
  const chunk = new Uint8Array(1024).fill(97);
  const pulled = { count: 0 };
  const r = await readLimitedBody(
    streamed(Array(1000).fill(chunk), pulled),
    4096,
  );
  assert.deepEqual(r, { ok: false, error: "too_large" });
  assert.ok(pulled.count <= 6, `pulled ${pulled.count} of 1000 chunks`);
});

test("the limit counts bytes, not characters", async () => {
  // 3000 characters of "é" are 6000 bytes in UTF-8.
  const text = "é".repeat(3000);
  const r = await readLimitedBody(
    streamed([new TextEncoder().encode(text)]),
    4096,
  );
  assert.deepEqual(r, { ok: false, error: "too_large" });
});

test("a body at the limit is read whole, even when split mid-character", async () => {
  const bytes = new TextEncoder().encode(`{"name":"${"é".repeat(10)}"}`);
  const r = await readLimitedBody(
    streamed([bytes.slice(0, 10), bytes.slice(10)]),
    bytes.byteLength,
  );
  assert.equal(r.ok, true);
  assert.equal(JSON.parse(r.text).name, "é".repeat(10));
});

test("invalid UTF-8 is replaced, as Request.text() did, not rejected", async () => {
  const r = await readLimitedBody(
    streamed([new Uint8Array([0x7b, 0xff, 0x7d])]),
    100,
  );
  assert.deepEqual(r, { ok: true, text: "{�}" });
});

test("the guard uses the safe helpers, not raw parsing", () => {
  const guard = read("src/lib/server/submissions.ts");
  assert.match(guard, /isForeignOrigin\(origin, host\)/);
  assert.match(guard, /readLimitedBody\(request, MAX_BODY_BYTES\)/);
  assert.doesNotMatch(guard, /new URL\(origin\)/);
  assert.doesNotMatch(guard, /request\.text\(\)/);
});

test("a deploy cannot publish photographs whose permission is pending", async () => {
  const { spawnSync } = await import("node:child_process");
  const render = readFileSync(join(appRoot, "../../render.yaml"), "utf8");
  const build = render.match(
    /name: motion-imprints[\s\S]*?buildCommand: (.+)/,
  )[1];
  assert.ok(
    build.indexOf("check:photos -w motion-imprints") <
      build.indexOf("run build -w motion-imprints"),
    "the photo gate runs before the build",
  );
  const pkg = JSON.parse(read("package.json"));
  assert.equal(
    pkg.scripts["check:photos"],
    "node scripts/launch-check.mjs --photos",
  );

  const manifest = JSON.parse(read("content/asset-manifest.json"));
  const pending = manifest.filter(
    (r) =>
      r.public_derivatives.length > 0 &&
      (r.permission !== "approved" || r.publication !== "launch-approved"),
  );
  const run = spawnSync(
    process.execPath,
    ["scripts/launch-check.mjs", "--photos"],
    {
      cwd: appRoot,
      encoding: "utf8",
      env: { ...process.env, NEXT_PUBLIC_SITE_URL: "" },
    },
  );
  // The gate is about photographs only: configuration is not its business.
  assert.doesNotMatch(run.stdout, /NEXT_PUBLIC|DATABASE_URL|ALLOW_INDEXING/);
  assert.equal(run.status, pending.length > 0 ? 1 : 0);
  if (pending.length) assert.match(run.stdout, /Deploy stopped/);
});
