import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { updateDb } from "@/lib/store";
import type { Profile } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const u = await apiUser();
  const body = (await req.json()) as Partial<Profile>;
  const profile = await updateDb(u.id, (db) => {
    for (const k of Object.keys(db.profile) as (keyof Profile)[]) {
      if (typeof body[k] === "string") db.profile[k] = body[k]!.slice(0, 2000);
    }
    return db.profile;
  });
  return json({ profile });
});
