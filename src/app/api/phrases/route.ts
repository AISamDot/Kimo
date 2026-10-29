import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { mergePhrases, reviewPhrase, today, type Grade } from "@/lib/practice";
import { newId, updateDb } from "@/lib/store";
import type { Phrase } from "@/lib/types";

const GRADES: Grade[] = ["again", "hard", "good", "easy"];
const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// { add: [{de, en, note}], source } | { review: id, grade }
export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const b = (await req.json()) as { add?: { de: string; en?: string; note?: string }[]; source?: Phrase["source"]; review?: string; grade?: Grade };
  const day = today();
  if (b.review) {
    if (!GRADES.includes(b.grade as Grade)) throw new Error("Bad grade");
    const phrase = await updateDb(u.id, (d) => {
      const i = d.phrases.findIndex((p) => p.id === b.review);
      if (i < 0) throw new Error("Phrase not found");
      d.phrases[i] = reviewPhrase(d.phrases[i], b.grade!, day);
      return d.phrases[i];
    });
    return json({ phrase });
  }
  const source: Phrase["source"] = b.source === "job" || b.source === "session" ? b.source : "manual";
  const now = new Date().toISOString();
  const incoming = (b.add ?? []).slice(0, 50).map((x) => ({ id: newId("phr"), de: str(x.de), en: str(x.en), note: str(x.note), source, createdAt: now })).filter((x) => x.de);
  if (!incoming.length) throw new Error("Type a German phrase.");
  const added = await updateDb(u.id, (d) => mergePhrases(d.phrases, incoming, day));
  return json({ added });
});

export const DELETE = handle(async (req: Request) => {
  const u = await apiUser();
  const id = new URL(req.url).searchParams.get("id");
  await updateDb(u.id, (d) => {
    d.phrases = d.phrases.filter((p) => p.id !== id);
  });
  return json({ ok: true });
});
