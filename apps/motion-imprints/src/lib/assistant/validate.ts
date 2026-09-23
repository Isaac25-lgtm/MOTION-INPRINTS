/**
 * Validation for the website assistant. Pure, so tests load it directly.
 *
 * The browser sends the short conversation each time; the server keeps no
 * chat history (master handoff §9.10: do not retain full chat histories).
 */

export const MAX_TURNS = 12;
export const MAX_USER_CHARS = 800;
export const MAX_ASSISTANT_CHARS = 2400;

export type ChatTurn = { role: "user" | "assistant"; content: string };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const clean = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

export function validateChat(input: unknown): Result<ChatTurn[]> {
  if (typeof input !== "object" || input === null)
    return { ok: false, error: "unreadable" };
  const raw = (input as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0)
    return { ok: false, error: "empty" };

  // Keep only the most recent turns; the first kept turn must be the user's.
  let recent = raw.slice(-MAX_TURNS);
  while (recent.length && (recent[0] as { role?: unknown })?.role !== "user")
    recent = recent.slice(1);

  const turns: ChatTurn[] = [];
  for (const [i, t] of recent.entries()) {
    if (typeof t !== "object" || t === null)
      return { ok: false, error: "turn" };
    const { role, content } = t as { role?: unknown; content?: unknown };
    const expected = i % 2 === 0 ? "user" : "assistant";
    if (role !== expected || typeof content !== "string")
      return { ok: false, error: "order" };
    const text = clean(content);
    const limit = role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS;
    if (!text) return { ok: false, error: "blank" };
    if (text.length > limit) return { ok: false, error: "too_long" };
    turns.push({ role: expected, content: text });
  }
  if (!turns.length || turns[turns.length - 1].role !== "user")
    return { ok: false, error: "order" };
  return { ok: true, value: turns };
}

export type Handoff = {
  summary: string;
  name: string;
  phone: string;
  email: string;
};

const PHONE = /^\+?[0-9][0-9 ()-]{5,22}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export function validateHandoff(
  input: unknown,
): Result<Handoff> & { spam?: boolean } {
  if (typeof input !== "object" || input === null)
    return { ok: false, error: "unreadable" };
  const b = input as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? clean(v).slice(0, max) : "";
  if (str(b.website, 200)) return { ok: false, error: "rejected", spam: true };
  if (b.consent !== true) return { ok: false, error: "consent" };
  const summary = str(b.summary, 600);
  const name = str(b.name, 120);
  const phone = str(b.phone, 30);
  const email = str(b.email, 254);
  if (summary.length < 10) return { ok: false, error: "summary" };
  if (name.length < 2) return { ok: false, error: "name" };
  const phoneOk =
    PHONE.test(phone) &&
    phone.replace(/\D/g, "").length >= 7 &&
    phone.replace(/\D/g, "").length <= 15;
  if (!phoneOk && !(email && EMAIL.test(email)))
    return { ok: false, error: "contact" };
  return {
    ok: true,
    value: { summary, name, phone: phoneOk ? phone : "", email },
  };
}
