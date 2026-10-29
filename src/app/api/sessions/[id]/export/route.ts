import { handle } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { sessionMarkdown } from "@/lib/reportMarkdown";
import { readDb, readSession } from "@/lib/store";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  const s = await readSession(u.id, id);
  if (!s?.analysis) throw new Error("No report for this session yet.");
  const job = (await readDb(u.id)).jobs.find((j) => j.id === s.jobId);
  const md = sessionMarkdown(s, job);
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="interview-report-${s.createdAt.slice(0, 10)}.md"`,
    },
  });
});
