import Anthropic from "@anthropic-ai/sdk";
import type { ChatTurn } from "./validate";

/**
 * Minimal provider seam (master handoff §9.10: "abstract provider minimally so
 * another model can be swapped"). A provider turns a system prompt and a short
 * conversation into one reply. Only the Claude implementation exists today;
 * another provider is added by implementing AssistantProvider and selecting
 * it with ASSISTANT_PROVIDER.
 */
export type Reply =
  | { kind: "text"; text: string }
  | { kind: "declined" }
  | { kind: "error"; retryable: boolean };

export type AssistantProvider = {
  name: string;
  reply(system: string, turns: ChatTurn[]): Promise<Reply>;
};

const DEFAULT_MODEL = "claude-opus-5";

/**
 * The website's own key only. The SDK would otherwise pick up ambient
 * credentials (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or a local profile)
 * from whatever shell started the server; the assistant must never borrow
 * those, so the key is passed explicitly and bearer auth is switched off.
 */
const KEY_VAR = "MOTION_ASSISTANT_API_KEY";

function claudeProvider(apiKey: string): AssistantProvider {
  const client = new Anthropic({
    apiKey,
    authToken: null,
    timeout: 30_000,
    maxRetries: 1,
  });
  const model = process.env.ASSISTANT_MODEL || DEFAULT_MODEL;
  return {
    name: "anthropic",
    async reply(system, turns) {
      try {
        const response = await client.beta.messages.create({
          model,
          max_tokens: 2048,
          // Short answers: low effort keeps latency and cost down.
          output_config: { effort: "low" },
          // If a safety classifier declines, retry on Anthropic's
          // recommended fallback model server-side.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          // The approved-content prompt is identical on every request.
          system: [
            {
              type: "text",
              text: system,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: turns,
        });
        if (response.stop_reason === "refusal") return { kind: "declined" };
        const text = response.content
          .flatMap((b) => (b.type === "text" ? [b.text] : []))
          .join("\n")
          .trim();
        return text
          ? { kind: "text", text }
          : { kind: "error", retryable: true };
      } catch (error) {
        if (error instanceof Anthropic.RateLimitError)
          return { kind: "error", retryable: true };
        if (error instanceof Anthropic.APIError)
          return { kind: "error", retryable: (error.status ?? 500) >= 500 };
        return { kind: "error", retryable: true };
      }
    },
  };
}

let cached: AssistantProvider | null | undefined;

/** The configured provider, or null when the assistant is not switched on. */
export function getProvider(): AssistantProvider | null {
  if (cached !== undefined) return cached;
  const key = process.env[KEY_VAR];
  cached = assistantConfigured() && key ? claudeProvider(key) : null;
  return cached;
}

export function assistantConfigured() {
  return (
    (process.env.ASSISTANT_PROVIDER || "anthropic") === "anthropic" &&
    Boolean(process.env[KEY_VAR])
  );
}
