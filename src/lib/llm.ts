import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { getSettings } from "./store";

export type LlmRole = "interviewer" | "analysis" | "verdict";

export class MissingKeyError extends Error {
  constructor(service: string) {
    super(`${service} API key is missing. Add it on the Integrations page.`);
  }
}

async function client() {
  const key = (await getSettings()).keys.anthropic;
  if (!key) throw new MissingKeyError("Anthropic (Claude)");
  return new Anthropic({ apiKey: key, maxRetries: 2 });
}

type Content = string | Anthropic.Beta.Messages.BetaContentBlockParam[];

// One structured call to Claude. Output is constrained to the Zod schema.
// Server-side refusal fallback ("default") is on so a rare safety decline is
// re-run on Anthropic's recommended fallback model instead of failing.
export async function llmJson<S extends z.ZodType>(
  schema: S,
  opts: {
    role: LlmRole;
    system: string;
    content: Content;
    history?: Anthropic.Beta.Messages.BetaMessageParam[];
    maxTokens?: number;
  },
): Promise<z.infer<S>> {
  const settings = await getSettings();
  const model = settings.models[opts.role];
  const effort = settings.effort[opts.role];
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    ...(opts.history ?? []),
    { role: "user", content: opts.content },
  ];
  const res = await (await client()).beta.messages.parse({
    model,
    max_tokens: opts.maxTokens ?? 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    messages,
    output_config: { effort, format: betaZodOutputFormat(schema) },
  });
  if (res.stop_reason === "refusal") {
    throw new Error("Claude declined this request. Try rephrasing the input.");
  }
  if (res.stop_reason === "max_tokens") {
    throw new Error("Claude's answer was cut off (max tokens). Try again.");
  }
  if (res.parsed_output == null) throw new Error("Claude returned output that did not match the expected format.");
  return res.parsed_output as z.infer<S>;
}

export function friendlyError(e: unknown): string {
  if (e instanceof MissingKeyError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "Claude rejected the API key. Check it on the Integrations page.";
  if (e instanceof Anthropic.RateLimitError) return "Claude rate limit reached. Wait a minute and retry.";
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status ?? ""}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
