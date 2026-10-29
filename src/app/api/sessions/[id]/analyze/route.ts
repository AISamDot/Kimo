import { startAnalysis } from "@/lib/analysis";
import { after } from "next/server";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { readSession } from "@/lib/store";

// Re-run the analysis (e.g. after it failed, or after adding keys).
// Scoring runs after the response; allow up to 5 minutes.
export const maxDuration = 300;

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  const s = await readSession(u.id, id);
  if (!s) throw new Error("Session not found");
  if (s.status === "live") throw new Error("End the interview first.");
  after(await startAnalysis(u.id, id));
  return json({ ok: true });
});
