import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { readDb, readSession, wipeUserData } from "@/lib/store";

// Export everything this user has (JSON download).
export const GET = handle(async () => {
  const u = await apiUser();
  const db = await readDb(u.id);
  const sessions = (await Promise.all(db.sessions.map((s) => readSession(u.id, s.id)))).filter(Boolean);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), user: u, ...db, sessions }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mock-interview-buddy-export.json"`,
    },
  });
});

// Delete all of this user's data (account stays).
export const DELETE = handle(async () => {
  const u = await apiUser();
  await wipeUserData(u.id);
  return json({ ok: true });
});
