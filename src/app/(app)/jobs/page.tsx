import Link from "next/link";
import { UploadForm } from "@/components/UploadForm";
import { Card, Empty, PageHeader, Pill, ScoreBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readiness } from "@/lib/metrics";
import { getSettings, readDb } from "@/lib/store";

export default async function JobsPage() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <PageHeader title="Job ads" sub="Add the ads you applied to. Each one becomes a practice track: CV fit review, tailored interviews, and its own score trend." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Add a job ad">
          <UploadForm endpoint="/api/jobs" kind="job" allowUrl redirectBase="/jobs" />
        </Card>
        <div className="space-y-3 lg:col-span-2">
          {db.jobs.length === 0 ? (
            <Empty title="No job ads yet">Paste the ad text, upload a PDF, or give a link (some job boards block automatic reading; pasting always works).</Empty>
          ) : (
            [...db.jobs].reverse().map((j) => {
              const sessions = db.sessions.filter((s) => s.jobId === j.id);
              const r = readiness(sessions, settings.readiness);
              const best = Math.max(...db.jobReviews.filter((x) => x.jobId === j.id).map((x) => x.result.fitScore), -1);
              return (
                <Link key={j.id} href={`/jobs/${j.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:border-accent">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{j.parsed.title}</div>
                      <div className="text-sm text-muted">
                        {j.parsed.company} · {j.parsed.location} · {j.parsed.seniority}
                      </div>
                    </div>
                    <ScoreBadge score={r.avg} size="sm" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill tone="accent">German needed: {j.parsed.germanRequired.implied || "?"}</Pill>
                    <Pill>{sessions.length} session(s)</Pill>
                    {best >= 0 && <Pill tone={best >= 75 ? "good" : best >= 55 ? "warn" : "bad"}>CV fit {best}</Pill>}
                    {r.ready && <Pill tone="good">Interview-ready</Pill>}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
