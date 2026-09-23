import { buildSystemPrompt } from "@/lib/assistant/knowledge";
import { getProvider } from "@/lib/assistant/provider";
import { validateChat } from "@/lib/assistant/validate";
import { createRateLimiter } from "@/lib/leads/rate-limit";
import { guard, json, logEvent } from "@/lib/server/submissions";

export const runtime = "nodejs";

const limiter = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });
let system: string | null = null;

/**
 * One assistant reply. The conversation comes from the browser each time and
 * is not stored or logged; only an event name and outcome are logged.
 */
export async function POST(request: Request) {
  const checked = await guard(request, limiter);
  if ("response" in checked) return checked.response;

  const chat = validateChat(checked.body);
  if (!chat.ok) return json(422, { error: chat.error });

  const provider = getProvider();
  if (!provider) return json(503, { error: "unavailable" });

  system ??= buildSystemPrompt();
  const started = Date.now();
  const reply = await provider.reply(system, chat.value);
  logEvent("assistant.reply", {
    outcome: reply.kind,
    turns: chat.value.length,
    ms: Date.now() - started,
  });

  if (reply.kind === "text") return json(200, { reply: reply.text });
  if (reply.kind === "declined")
    return json(200, {
      reply:
        "I can't help with that here. A person from the team can: use Talk to a person below.",
    });
  return json(reply.retryable ? 503 : 502, { error: "provider" });
}
