import { feedbackEmail } from "@/lib/ai";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { readDb } from "@/lib/store";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const { id } = await params;
  const { lang } = (await req.json()) as { lang: "en" | "de" };
  const db = await readDb(u.id);
  const app = db.applications.find((a) => a.id === id);
  if (!app) throw new Error("Application not found");
  return json(await feedbackEmail(app, lang === "de" ? "de" : "en", db.profile.name || u.name));
});
