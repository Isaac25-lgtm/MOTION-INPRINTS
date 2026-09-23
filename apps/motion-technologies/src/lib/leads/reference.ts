/**
 * Human-readable request references, e.g. MI-T-260923-7KQ4M (T Technologies inquiry, A assistant handoff).
 *
 * Crockford-style alphabet without I, L, O or U, so a reference read aloud
 * over the phone is not misheard. The database enforces uniqueness and the
 * repository retries on the rare collision.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type ReferenceKind = "T" | "A";

export function makeReference(
  kind: ReferenceKind,
  now = new Date(),
  random: (n: number) => Uint8Array = (n) =>
    crypto.getRandomValues(new Uint8Array(n)),
) {
  // Date in East Africa Time so it matches the owner's calendar.
  const eat = new Date(now.getTime() + 3 * 3600000);
  const date = eat.toISOString().slice(2, 10).replace(/-/g, "");
  const bytes = random(5);
  let tail = "";
  for (const b of bytes) tail += ALPHABET[b % 32];
  return `MI-${kind}-${date}-${tail}`;
}

export const REFERENCE_PATTERN = /^MI-[TA]-\d{6}-[0-9A-HJKMNP-TV-Z]{5}$/;
