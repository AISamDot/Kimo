import { FinderView } from "@/components/FinderView";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSettings, readDb } from "@/lib/store";

export const metadata = { title: "Job finder" };

export default async function FinderPage() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const keys = (await getSettings()).keys;
  return (
    <div>
      <PageHeader
        eyebrow="Prepare"
        title="Job finder"
        sub="Live supply-chain openings in Germany, ranked against your CV, German level and target cities. Scoring is free and instant; the deeper Claude check is one click per job."
      />
      <FinderView
        finder={db.finder}
        hasCv={db.resumes.length > 0}
        germanLevel={db.profile.germanLevel}
        targetCities={db.profile.targetCities}
        hasAdzuna={!!(keys.adzunaAppId && keys.adzunaAppKey)}
      />
    </div>
  );
}
