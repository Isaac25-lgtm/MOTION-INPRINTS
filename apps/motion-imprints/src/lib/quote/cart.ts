/**
 * Guest quote list ("cart"): pure operations, no framework imports, so the
 * tests can load this file directly.
 *
 * The list lives in the visitor's own browser (localStorage). It holds only
 * product choices and notes, never contact details: name, phone and email are
 * typed into the submission form and sent once, not persisted locally.
 *
 * Titles and units are stored for display. The server ignores them and
 * re-reads every product from the catalogue when a request is submitted.
 */

export const CART_KEY = "motion-quote-v1";
export const MAX_LINES = 30;
export const MAX_QUANTITY = 100000;
export const MAX_LINE_NOTES = 600;

export type CartLine = {
  id: string;
  slug: string;
  title: string;
  unit: string;
  /** Option id → chosen value. */
  options: Record<string, string>;
  quantity: number;
  notes: string;
};

export type NewLine = Omit<CartLine, "id">;

export function clampQuantity(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_QUANTITY);
}

function sameChoice(a: CartLine, b: NewLine) {
  if (a.slug !== b.slug || a.notes.trim() !== b.notes.trim()) return false;
  const keys = new Set([...Object.keys(a.options), ...Object.keys(b.options)]);
  for (const k of keys) if (a.options[k] !== b.options[k]) return false;
  return true;
}

/** Add a line. An identical line (same product, options and notes) grows. */
export function addLine(
  lines: CartLine[],
  line: NewLine,
  makeId: () => string,
): CartLine[] {
  const clean: NewLine = {
    ...line,
    quantity: clampQuantity(line.quantity),
    notes: line.notes.slice(0, MAX_LINE_NOTES),
  };
  const match = lines.find((l) => sameChoice(l, clean));
  if (match) {
    return lines.map((l) =>
      l === match
        ? { ...l, quantity: clampQuantity(l.quantity + clean.quantity) }
        : l,
    );
  }
  if (lines.length >= MAX_LINES) return lines;
  return [...lines, { ...clean, id: makeId() }];
}

export function updateLine(
  lines: CartLine[],
  id: string,
  patch: Partial<Pick<CartLine, "quantity" | "notes">>,
): CartLine[] {
  return lines.map((l) =>
    l.id === id
      ? {
          ...l,
          ...(patch.quantity !== undefined
            ? { quantity: clampQuantity(patch.quantity) }
            : {}),
          ...(patch.notes !== undefined
            ? { notes: patch.notes.slice(0, MAX_LINE_NOTES) }
            : {}),
        }
      : l,
  );
}

export function removeLine(lines: CartLine[], id: string): CartLine[] {
  return lines.filter((l) => l.id !== id);
}

export function countUnits(lines: CartLine[]) {
  return lines.length;
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string")
  );
}

/** Read what localStorage holds, dropping anything malformed. */
export function parseStored(raw: string | null): CartLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: CartLine[] = [];
  for (const item of data.slice(0, MAX_LINES)) {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.slug === "string" &&
      typeof item.title === "string" &&
      typeof item.unit === "string" &&
      isRecordOfStrings(item.options) &&
      typeof item.notes === "string"
    ) {
      out.push({
        id: item.id,
        slug: item.slug,
        title: item.title,
        unit: item.unit,
        options: item.options,
        quantity: clampQuantity(item.quantity),
        notes: item.notes.slice(0, MAX_LINE_NOTES),
      });
    }
  }
  return out;
}
