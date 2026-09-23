import { getProduct } from "@/content/catalogue";
import {
  getRepository,
  guard,
  json,
  logEvent,
  notify,
  quoteLimiter,
} from "@/lib/server/submissions";
import { validateQuote } from "@/lib/quote/validate";

export const runtime = "nodejs";

/** Guest quote request: validate, store transactionally, then notify. */
export async function POST(request: Request) {
  const checked = await guard(request, quoteLimiter);
  if ("response" in checked) return checked.response;

  const result = validateQuote(checked.body, (slug) => getProduct(slug));
  if (!result.ok) {
    if (result.spam) {
      logEvent("quote.rejected", { reason: "honeypot" });
      return json(400, { error: "rejected" });
    }
    return json(422, { error: "invalid", fields: result.errors });
  }

  const repo = getRepository();
  if (!repo) {
    logEvent("quote.unavailable", { reason: "no_database" });
    return json(503, { error: "unavailable" });
  }

  let saved;
  try {
    saved = await repo.saveQuote(result.value);
  } catch (error) {
    logEvent("quote.failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return json(500, { error: "failed" });
  }

  const { contact, items } = result.value;
  const sent = await notify(
    `New quote request ${saved.reference}: ${items.length} item(s) from ${contact.name}` +
      `${contact.organisation ? ` (${contact.organisation})` : ""}, ${contact.phone}.`,
  );
  if (sent) await repo.markNotified("orders", saved.id).catch(() => {});
  logEvent("quote.saved", { reference: saved.reference, notified: sent });

  return json(201, { reference: saved.reference });
}
