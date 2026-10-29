import { ApplicationsEditor } from "@/components/ApplicationsEditor";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { biggestDropOff, funnel, funnelBy } from "@/lib/metrics";
import { readDb } from "@/lib/store";
import { STAGE_LABELS } from "@/lib/types";

export default async function ApplicationsPage() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const rows = funnel(db.applications);
  const drop = biggestDropOff(rows);
  const byLang = funnelBy(db.applications.filter((a) => a.interviewLanguage), "interviewLanguage");
  const max = Math.max(1, rows[0].reached);
  return (
    <div className="space-y-6">
      <PageHeader title="Real applications" sub="Log every real application and how far it got. This funnel is the hardest evidence of where you're dropping out." />
      {db.applications.length > 0 && (
        <Card title="Your funnel">
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.stage} className="flex items-center gap-3 text-sm">
                <div className="w-36 shrink-0 text-muted">{STAGE_LABELS[r.stage]}</div>
                <div className="h-6 flex-1 overflow-hidden rounded bg-surface-2">
                  <div className="flex h-full items-center rounded bg-accent px-2 text-xs font-medium text-accent-ink" style={{ width: `${Math.max(4, (r.reached / max) * 100)}%` }}>
                    {r.reached}
                  </div>
                </div>
                <div className="w-24 shrink-0 text-right text-xs text-muted tabular-nums">{r.conversionFromPrev != null ? `${r.conversionFromPrev}% of prev` : ""}</div>
              </div>
            ))}
          </div>
          {drop && (
            <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              Biggest drop: {STAGE_LABELS[drop.from]} → {STAGE_LABELS[drop.to]} ({drop.conversion}% get through). Focus your practice there.
            </p>
          )}
          {byLang.length > 1 && (
            <div className="mt-4 text-sm">
              <div className="font-semibold">By interview language</div>
              <ul className="mt-1 space-y-0.5 text-muted">
                {byLang.map((g) => (
                  <li key={g.group}>
                    {g.group.toUpperCase()}: {g.n} application(s), {g.rows[3].reached} reached a second interview, {g.rows[5].reached} offer(s)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
      <ApplicationsEditor
        apps={db.applications}
        resumes={db.resumes.map((r) => ({ id: r.id, label: r.label }))}
        jobs={db.jobs.map((j) => ({ id: j.id, label: `${j.parsed.title} — ${j.parsed.company}` }))}
      />
    </div>
  );
}
