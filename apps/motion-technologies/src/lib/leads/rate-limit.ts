/**
 * Fixed-window rate limiter held in memory.
 *
 * Suitable for the planned single Render web service. If the site is scaled to
 * several instances, each keeps its own window: limits then apply per instance,
 * which still blunts abuse but is not exact. Replace with a shared store if
 * that ever matters.
 */

export type RateLimiter = {
  /** Returns true when the request is allowed. */
  check(key: string, now?: number): boolean;
  size(): number;
};

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 5000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const hits = new Map<string, { start: number; count: number }>();

  function sweep(now: number) {
    for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
  }

  return {
    check(key, now = Date.now()) {
      const entry = hits.get(key);
      if (!entry || now - entry.start >= windowMs) {
        if (hits.size >= maxKeys) sweep(now);
        if (hits.size >= maxKeys) return false;
        hits.set(key, { start: now, count: 1 });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
    size: () => hits.size,
  };
}
