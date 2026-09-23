/**
 * Request checks that must never throw on hostile input. No imports, so the
 * tests can load this file directly.
 */

/**
 * True when the request comes from another site. An Origin that cannot be
 * parsed (for example "null" or garbage) counts as foreign, so it is refused
 * with 403 rather than crashing the route with a 500.
 */
export function isForeignOrigin(origin: string | null, host: string | null) {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export type BodyRead =
  { ok: true; text: string } | { ok: false; error: "too_large" | "unreadable" };

/**
 * Read a request body as UTF-8 text, stopping as soon as it exceeds
 * `maxBytes`. The limit is counted in bytes as they arrive, so a streamed
 * body with no or a false Content-Length cannot make the server buffer more
 * than the limit.
 */
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
): Promise<BodyRead> {
  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, error: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: "unreadable" };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // Lenient like Request.text(): invalid bytes become U+FFFD instead of
  // failing the request. Browsers always send UTF-8 here.
  return { ok: true, text: new TextDecoder().decode(bytes) };
}
