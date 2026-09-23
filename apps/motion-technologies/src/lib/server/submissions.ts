import { Pool } from "pg";
import { makeReference } from "@/lib/leads/reference";
import { createRateLimiter } from "@/lib/leads/rate-limit";
import {
  createMemoryLeadRepository,
  createLeadRepository,
  type LeadRepository,
} from "@/lib/leads/repository";
import { MAX_BODY_BYTES } from "@/lib/leads/validate";
import { isForeignOrigin, readLimitedBody } from "./request-body";

/**
 * Server-only wiring for form submissions: database, rate limits,
 * notifications and the shared request guard. Imported only by route
 * handlers.
 */

type Globals = {
  motionTechPool?: Pool;
  motionTechMemoryRepo?: LeadRepository;
};
const g = globalThis as typeof globalThis & Globals;

/**
 * The configured repository, or null when persistence is unavailable.
 *
 * - DATABASE_URL set: Neon/Postgres through one small pool per instance (use
 *   Neon's pooled connection string in production).
 * - Otherwise, in development only, QUOTE_STORE=memory enables an in-memory
 *   store so the flow can be tried locally.
 * - Otherwise null: routes answer 503 and the page offers direct contact.
 */
export function getRepository(): LeadRepository | null {
  const url = process.env.DATABASE_URL;
  if (url) {
    g.motionTechPool ??= new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
      ssl: /sslmode=disable/.test(url) ? false : { rejectUnauthorized: true },
    });
    const pool = g.motionTechPool;
    return createLeadRepository(() => pool.connect(), makeReference);
  }
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.QUOTE_STORE === "memory"
  ) {
    g.motionTechMemoryRepo ??= createMemoryLeadRepository(makeReference);
    return g.motionTechMemoryRepo;
  }
  return null;
}

export const leadLimiter = createRateLimiter({
  limit: 5,
  windowMs: 10 * 60_000,
});

export function json(status: number, body: unknown) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * The client address used for rate limiting.
 *
 * The first X-Forwarded-For entry is whatever the client sent, so it cannot be
 * trusted. Take the entry added by our own proxy instead: by default the last
 * one (one proxy hop, as on Render). RATE_LIMIT_IP_HEADER can name a header a
 * trusted edge overwrites (for example cf-connecting-ip) and
 * TRUSTED_PROXY_HOPS can count extra hops. Confirm both on the live service.
 */
function clientKey(request: Request) {
  const named = process.env.RATE_LIMIT_IP_HEADER;
  if (named) return request.headers.get(named)?.trim() || "unknown";
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1);
  const chain = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return chain[chain.length - hops] ?? chain[0] ?? "unknown";
}

/**
 * Shared checks before a body is parsed: same-origin, JSON, size and rate.
 * Returns the parsed body or a ready error response.
 */
export async function guard(
  request: Request,
  limiter: typeof leadLimiter,
): Promise<{ body: unknown } | { response: Response }> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (isForeignOrigin(origin, host))
    return { response: json(403, { error: "forbidden" }) };

  if (!request.headers.get("content-type")?.includes("application/json"))
    return { response: json(415, { error: "unsupported" }) };

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES)
    return { response: json(413, { error: "too_large" }) };

  if (!limiter.check(clientKey(request)))
    return { response: json(429, { error: "rate_limited" }) };

  const read = await readLimitedBody(request, MAX_BODY_BYTES);
  if (!read.ok)
    return {
      response:
        read.error === "too_large"
          ? json(413, { error: "too_large" })
          : json(400, { error: "invalid_json" }),
    };
  try {
    return { body: JSON.parse(read.text) };
  } catch {
    return { response: json(400, { error: "invalid_json" }) };
  }
}

/**
 * Tell the team about a new request through an optional webhook
 * (NOTIFY_WEBHOOK_URL, for example a Slack, Teams or automation endpoint).
 * Failure never loses the request: it is already stored, and notified_at stays
 * empty so unnotified requests can be found.
 */
export async function notify(text: string): Promise<boolean> {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Log without personal data: an event name, a reference and an error code. */
export function logEvent(event: string, detail: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({ event, ...detail, at: new Date().toISOString() }),
  );
}
