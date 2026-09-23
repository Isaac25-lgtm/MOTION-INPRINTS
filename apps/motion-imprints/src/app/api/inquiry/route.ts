import {
  getRepository,
  guard,
  inquiryLimiter,
  json,
  logEvent,
  notify,
} from "@/lib/server/submissions";
import { validateInquiry } from "@/lib/quote/validate";

export const runtime = "nodejs";

/** Contact, service and product inquiries, and feedback. */
export async function POST(request: Request) {
  const checked = await guard(request, inquiryLimiter);
  if ("response" in checked) return checked.response;

  const result = validateInquiry(checked.body);
  if (!result.ok) {
    if (result.spam) {
      logEvent("inquiry.rejected", { reason: "honeypot" });
      return json(400, { error: "rejected" });
    }
    return json(422, { error: "invalid", fields: result.errors });
  }

  const repo = getRepository();
  if (!repo) {
    logEvent("inquiry.unavailable", { reason: "no_database" });
    return json(503, { error: "unavailable" });
  }

  let saved;
  try {
    saved = await repo.saveInquiry(result.value, "imprints");
  } catch (error) {
    logEvent("inquiry.failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return json(500, { error: "failed" });
  }

  const { contact, topic } = result.value;
  const sent = await notify(
    `New ${topic} message ${saved.reference} from ${contact.name}, ${contact.phone}.`,
  );
  if (sent) await repo.markNotified("inquiries", saved.id).catch(() => {});
  logEvent("inquiry.saved", { reference: saved.reference, notified: sent });

  return json(201, { reference: saved.reference });
}
