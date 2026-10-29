import Link from "next/link";
import { Card, Empty, LinkButton, PageHeader, Pill, ScoreBadge, VERDICT_LABEL, VERDICT_TONE, fmtDate } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readiness } from "@/lib/metrics";
import { getSettings, readDb } from "@/lib/store";
import { COMPETENCY_LABELS } from "@/lib/types";

export default async function Home() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const settings = await getSettings();
  const done = db.sessions.filter((s) => s.status === "done").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const last = done[0];
  const diag = db.diagnoses.at(-1);
  const openDrills = db.drills.filter((d) => d.status === "open").slice(-5).reverse();

  const steps = [
    { done: !!settings.keys.anthropic, label: user.role === "admin" ? "Add your Claude API key" : "Ask the admin to add a Claude API key", href: "/integrations" },
    { done: !!(db.profile.germanLevel || db.profile.visaStatus), label: "Fill in your profile (German level, visa status…)", href: "/settings" },
    { done: db.resumes.length > 0, label: "Upload your CV", href: "/cv" },
    { done: db.jobs.length > 0, label: "Add a job ad you applied for", href: "/jobs" },
    { done: db.applications.length >= 5, label: "Log your real applications (at least 5)", href: "/applications" },
    { done: done.length > 0, label: "Do your first mock interview", href: "/interview/new" },
  ];
  const pending = steps.filter((s) => !s.done);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi ${(db.profile.name || user.name).split(" ")[0]}`}
        sub="Practise for the jobs you applied to, then find out what's really costing you the offer."
        action={<LinkButton href="/interview/new">Start a mock interview</LinkButton>}
      />

      {pending.length > 0 && (
        <Card title="Getting started">
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${s.done ? "bg-good-soft text-good" : "bg-surface-2 text-muted"}`}>
                  {s.done ? "✓" : i + 1}
                </span>
                {s.done ? (
                  <span className="text-muted line-through">{s.label}</span>
                ) : (
                  <Link href={s.href} className="underline decoration-line underline-offset-4 hover:text-accent">
                    {s.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Last session" className="lg:col-span-1">
          {last ? (
            <Link href={`/sessions/${last.id}`} className="flex items-center gap-4">
              <ScoreBadge score={last.overall} size="lg" />
              <div>
                <div className="font-medium">{db.jobs.find((j) => j.id === last.jobId)?.parsed.title ?? "Job"}</div>
                <div className="text-sm text-muted">{fmtDate(last.createdAt)}</div>
                {last.verdict && <Pill tone={VERDICT_TONE[last.verdict]}>Verdict: {VERDICT_LABEL[last.verdict]}</Pill>}
              </div>
            </Link>
          ) : (
            <p className="text-sm text-muted">No scored sessions yet.</p>
          )}
        </Card>

        <Card title="Diagnosis" className="lg:col-span-2" action={<Link href="/diagnosis" className="text-sm text-accent underline">Open</Link>}>
          {diag ? (
            <div>
              <p className="font-serif text-lg">{diag.headline}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {diag.causes.slice(0, 3).map((c) => (
                  <li key={c.rank}>
                    #{c.rank} {c.title} <Pill tone={c.confidence === "high" ? "bad" : c.confidence === "medium" ? "warn" : "neutral"}>{c.confidence}</Pill>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Generated {fmtDate(diag.createdAt)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Log a few real applications and do 2–3 mock interviews, then run the diagnosis to see why offers aren't coming.</p>
          )}
        </Card>
      </div>

      <Card title="Readiness by job">
        {db.jobs.length === 0 ? (
          <Empty title="No job ads yet" href="/jobs" cta="Add a job ad">Each job ad is its own practice track with unlimited sessions.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {db.jobs.map((j) => {
              const r = readiness(db.sessions.filter((s) => s.jobId === j.id), settings.readiness);
              return (
                <Link key={j.id} href={`/jobs/${j.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-accent">
                  <div>
                    <div className="font-medium">{j.parsed.title}</div>
                    <div className="text-sm text-muted">{j.parsed.company}</div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted">{r.reason}</span>
                    {r.ready ? <Pill tone="good">Interview-ready</Pill> : <Pill tone="warn">Practising</Pill>}
                    <ScoreBadge score={r.avg} size="sm" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Open drills" action={<Link href="/progress" className="text-sm text-accent underline">All drills</Link>}>
        {openDrills.length ? (
          <ul className="space-y-3">
            {openDrills.map((d) => (
              <li key={d.id} className="text-sm">
                <div className="font-medium">{d.title}</div>
                <div className="text-muted">{COMPETENCY_LABELS[d.skill]} · {d.detail}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Drills from your session reports show up here.</p>
        )}
      </Card>
    </div>
  );
}
