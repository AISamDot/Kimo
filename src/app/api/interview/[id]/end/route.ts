import { startAnalysis } from "@/lib/analysis";
import { after } from "next/server";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { readSession, updateSession } from "@/lib/store";
import type { PresenceSample } from "@/lib/types";

// Scoring runs after the response; allow up to 5 minutes.
export const maxDuration = 300;

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  const b = (await req.json()) as { presence?: PresenceSample; repeats?: number; lastInterviewerDurationMs?: number };
  const s = await readSession(u.id, id);
  if (!s) throw new Error("Session not found");
  if (s.status === "live") {
    await updateSession(u.id, id, (x) => {
      x.endedAt = new Date().toISOString();
      if (b.presence && b.presence.frames > 0) x.presenceOverall = b.presence;
      if (b.repeats) x.repeatRequests += b.repeats;
      const last = x.turns.at(-1);
      if (last?.speaker === "interviewer" && b.lastInterviewerDurationMs) last.durationMs = b.lastInterviewerDurationMs;
    });
  }
  const answered = s.turns.some((t) => t.speaker === "candidate" && t.text.trim());
  if (!answered) {
    await updateSession(u.id, id, (x) => {
      x.status = "failed";
      x.error = "The interview ended before any answer was recorded.";
    });
    return json({ ok: true, analyzing: false });
  }
  after(await startAnalysis(u.id, id));
  return json({ ok: true, analyzing: true });
});
