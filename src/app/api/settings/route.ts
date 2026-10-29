import { handle, json } from "@/lib/api";
import { apiAdmin, apiUser } from "@/lib/auth";
import { readApp, updateApp } from "@/lib/store";
import type { ApiKeys, Settings } from "@/lib/types";

const mask = (k: string) => (k ? `••••${k.slice(-4)}` : "");

function publicSettings(s: Settings) {
  const keys = Object.fromEntries(
    Object.entries(s.keys).map(([k, v]) => [k, k === "azureRegion" ? v : mask(v)]),
  ) as unknown as ApiKeys;
  return { ...s, keys };
}

export const GET = handle(async () => {
  await apiUser();
  const app = await readApp();
  return json({ settings: publicSettings(app.settings), allowSignups: app.allowSignups });
});

// Admin only. Keys: an empty string keeps the saved key, "__clear__" removes it.
export const POST = handle(async (req: Request) => {
  await apiAdmin();
  const body = (await req.json()) as { settings?: Partial<Settings> & { keys?: Partial<ApiKeys> }; allowSignups?: boolean };
  const app = await updateApp((a) => {
    if (typeof body.allowSignups === "boolean") a.allowSignups = body.allowSignups;
    const incoming = body.settings;
    if (!incoming) return a;
    const { keys, ...rest } = incoming;
    for (const [k, v] of Object.entries(keys ?? {})) {
      if (typeof v !== "string") continue;
      const key = k as keyof ApiKeys;
      if (!(key in a.settings.keys)) continue;
      if (v === "__clear__") a.settings.keys[key] = "";
      else if (v.trim() && !v.startsWith("••••")) a.settings.keys[key] = v.trim();
    }
    for (const [k, v] of Object.entries(rest)) {
      const key = k as keyof Settings;
      if (key in a.settings && v != null) {
        const cur = a.settings[key];
        (a.settings as unknown as Record<string, unknown>)[key] =
          typeof cur === "object" && cur !== null ? { ...cur, ...(v as object) } : v;
      }
    }
    return a;
  });
  return json({ settings: publicSettings(app.settings), allowSignups: app.allowSignups });
});
