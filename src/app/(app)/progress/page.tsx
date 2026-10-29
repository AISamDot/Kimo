import Link from "next/link";
import { LineChart, SERIES_COLORS, heatColor } from "@/components/charts";
import { DrillToggle } from "@/components/DrillToggle";
import { Card, Empty, PageHeader, Pill, Stat, fmtDate } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { COMPETENCIES, COMPETENCY_LABELS } from "@/lib/types";

export default async function ProgressPage() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const done = db.sessions.filter((s) => s.status === "done").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const jobTitle = (id: string) => db.jobs.find((j) => j.id === id)?.parsed.company ?? "";

  const weekAgo = Date.now() - 7 * 86400_000;
  const thisWeek = done.filter((s) => new Date(s.createdAt).getTime() > weekAgo).length;
  const minutes = done.reduce((m, s) => m + (s.endedAt ? (new Date(s.endedAt).getTime() - new Date(s.createdAt).getTime()) / 60000 : s.lengthMin), 0);
  // streak = consecutive days (ending today or yesterday) with at least one session
  const days = new Set(done.map((s) => s.createdAt.slice(0, 10)));
  let streak = 0;
  for (let d = new Date(); ; d.setDate(d.getDate() - 1)) {
    const k = d.toISOString().slice(0, 10);
    if (days.has(k)) streak++;
    else if (streak > 0 || k !== new Date().toISOString().slice(0, 10)) break;
  }
  const first = done[0]?.overall;
  const lastAvg = done.slice(-3).reduce((a, s) => a + (s.overall ?? 0), 0) / Math.max(1, Math.min(3, done.length));
  const usedComps = COMPETENCIES.filter((c) => done.some((s) => s.competencyScores?.[c] != null));
  const recent = done.slice(-12);
  const drills = [...db.drills].sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === "open" ? -1 : 1));

  if (!done.length) return <Empty title="No scored sessions yet" href="/interview/new" cta="Start practising">Your scores, skill heatmap and drills appear here after your first mock interview.</Empty>;

  return (
    <div className="space-y-6">
      <PageHeader title="Progress" sub="Every session is scored with the same rubric, so the trend is comparable over time." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Scored sessions" value={done.length} hint={`${thisWeek} this week`} />
        <Stat label="Practice time" value={`${Math.round(minutes)} min`} />
        <Stat label="Day streak" value={streak} />
        <Stat label="First → recent avg" value={`${first ?? "–"} → ${Math.round(lastAvg)}`} hint="overall score" />
      </div>

      <Card title="All sessions">
        <LineChart
          series={[
            { name: "Overall", color: SERIES_COLORS.overall, points: done.map((s) => ({ x: fmtDate(s.createdAt).slice(0, 6), y: s.overall ?? null })) },
            { name: "Content", color: SERIES_COLORS.content, points: done.map((s) => ({ x: "", y: s.areaScores?.content ?? null })) },
            { name: "Delivery", color: SERIES_COLORS.delivery, points: done.map((s) => ({ x: "", y: s.areaScores?.delivery ?? null })) },
            { name: "Language", color: SERIES_COLORS.language, points: done.map((s) => ({ x: "", y: s.areaScores?.language ?? null })) },
            { name: "Presence", color: SERIES_COLORS.presence, points: done.map((s) => ({ x: "", y: s.areaScores?.presence ?? null })) },
          ]}
        />
      </Card>

      <Card title="Skill heatmap (last 12 sessions, 1–5)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="text-left font-normal text-muted">Skill</th>
                {recent.map((s) => (
                  <th key={s.id} className="font-normal text-muted">
                    <Link href={`/sessions/${s.id}`} className="hover:underline" title={jobTitle(s.jobId)}>
                      {fmtDate(s.createdAt).slice(0, 6)}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usedComps.map((c) => (
                <tr key={c}>
                  <td className="pr-2 whitespace-nowrap">{COMPETENCY_LABELS[c]}</td>
                  {recent.map((s) => {
                    const v = s.competencyScores?.[c];
                    return (
                      <td key={s.id} className="h-8 min-w-10 rounded text-center font-medium tabular-nums" style={{ background: heatColor(v) }}>
                        {v ?? ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Drills">
        <p className="mb-3 text-xs text-muted">A drill ticks itself off when that skill scores 4/5 or higher in two sessions in a row on the same job. You can also tick it yourself.</p>
        <ul className="divide-y divide-line">
          {drills.map((d) => (
            <li key={d.id} className="flex gap-3 py-2.5 text-sm">
              <DrillToggle id={d.id} status={d.status} />
              <div className={d.status === "passed" ? "text-muted line-through" : ""}>
                <div className="font-medium">{d.title}</div>
                <div className="text-muted">{d.detail}</div>
                <div className="mt-1 flex gap-1.5">
                  <Pill>{COMPETENCY_LABELS[d.skill]}</Pill>
                  <Pill>{jobTitle(d.jobId)}</Pill>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
