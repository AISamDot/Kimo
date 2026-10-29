import { handle } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { synthesize } from "@/lib/speech";
import type { Lang } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  await apiUser();
  const { text, lang } = (await req.json()) as { text: string; lang: Lang };
  const { audio, mime } = await synthesize(String(text).slice(0, 2000), lang === "de" ? "de" : "en");
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": mime, "Cache-Control": "no-store" } });
});
