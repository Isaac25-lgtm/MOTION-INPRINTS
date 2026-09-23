import { solutions } from "@/content/solutions";
import { validateLead } from "@/lib/leads/validate";
import {
  getRepository,
  guard,
  json,
  leadLimiter,
  logEvent,
  notify,
} from "@/lib/server/submissions";

export const runtime = "nodejs";

const slugs = solutions.map((s) => s.slug);

/** Project inquiries, demo requests and quote requests for Technologies. */
export async function POST(request: Request) {
  const checked = await guard(request, leadLimiter);
  if ("response" in checked) return checked.response;

  const result = validateLead(checked.body, slugs);
  if (!result.ok) {
    if (result.spam) {
      logEvent("lead.rejected", { reason: "honeypot" });
      return json(400, { error: "rejected" });
    }
    return json(422, { error: "invalid", fields: result.errors });
  }

  const repo = getRepository();
  if (!repo) {
    logEvent("lead.unavailable", { reason: "no_database" });
    return json(503, { error: "unavailable" });
  }

  let saved;
  try {
    saved = await repo.saveLead(result.value);
  } catch (error) {
    logEvent("lead.failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return json(500, { error: "failed" });
  }

  const lead = result.value;
  const sent = await notify(
    `New Technologies ${lead.requestType} request ${saved.reference}: ${lead.solution}, ` +
      `${lead.name} (${lead.organisation}), ${lead.phone}.`,
  );
  if (sent) await repo.markNotified(saved.id).catch(() => {});
  logEvent("lead.saved", { reference: saved.reference, notified: sent });

  return json(201, { reference: saved.reference });
}
