import { IntegrationsForm } from "@/components/IntegrationsForm";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readApp } from "@/lib/store";
import type { Settings } from "@/lib/types";

export default async function IntegrationsPage() {
  const user = await requireUser();
  const app = await readApp();
  // never send real keys to the browser: mask them
  const masked: Settings = {
    ...app.settings,
    keys: Object.fromEntries(
      Object.entries(app.settings.keys).map(([k, v]) => [k, k === "azureRegion" ? v : v ? `••••${v.slice(-4)}` : ""]),
    ) as Settings["keys"],
  };
  return (
    <div>
      <PageHeader eyebrow="Setup" title="Integrations" sub="Connect the services the app uses. Only Claude is required; everything else upgrades realism or adds analysis." />
      <IntegrationsForm initial={masked} allowSignups={app.allowSignups} isAdmin={user.role === "admin"} />
    </div>
  );
}
