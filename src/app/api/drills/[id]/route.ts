import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { updateDb } from "@/lib/store";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  const { status } = (await req.json()) as { status: "open" | "passed" };
  await updateDb(u.id, (db) => {
    const d = db.drills.find((x) => x.id === id);
    if (!d) throw new Error("Drill not found");
    d.status = status === "passed" ? "passed" : "open";
    d.passedAt = d.status === "passed" ? new Date().toISOString() : undefined;
  });
  return json({ ok: true });
});
