import { validateHandoff } from "@/lib/assistant/validate";
import { createRateLimiter } from "@/lib/quote/rate-limit";
import {
  getRepository,
  guard,
  json,
  logEvent,
  notify,
} from "@/lib/server/submissions";

export const runtime = "nodejs";

const limiter = createRateLimiter({ limit: 4, windowMs: 10 * 60_000 });

/**
 * "Talk to a person": stores only the short summary the visitor approved and
 * the contact details they chose to give (chat_leads), never the transcript.
 */
export async function POST(request: Request) {
  const checked = await guard(request, limiter);
  if ("response" in checked) return checked.response;

  const result = validateHandoff(checked.body);
  if (!result.ok) {
    if (result.spam) return json(400, { error: "rejected" });
    return json(422, { error: result.error });
  }

  const repo = getRepository();
  if (!repo) return json(503, { error: "unavailable" });

  const body = checked.body as { path?: unknown };
  const path = typeof body.path === "string" ? body.path.slice(0, 200) : "";
  let saved;
  try {
    saved = await repo.saveHandoff({ ...result.value, sourcePath: path });
  } catch (error) {
    logEvent("handoff.failed", {
      code: (error as { code?: string }).code ?? "unknown",
    });
    return json(500, { error: "failed" });
  }
  const sent = await notify(
    `Assistant handoff ${saved.reference}: ${result.value.name}, ${result.value.phone || result.value.email}.`,
  );
  logEvent("handoff.saved", { reference: saved.reference, notified: sent });
  return json(201, { reference: saved.reference });
}
