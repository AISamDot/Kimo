import Link from "next/link";
import { Card, Empty, Icon, LinkButton, Pill, ScoreBadge, ScoreRing, Stat, VERDICT_LABEL, VERDICT_TONE, fmtDate } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readiness } from "@/lib/metrics";
import { addDays, daysUntil, duePhrases, nextInterview, storyCoverage, today, todayPlan } from "@/lib/practice";
import { getSettings, readDb } from "@/lib/store";
import { COMPETENCY_LABELS } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function Home() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const settings = await getSettings();
  const day = today();
  const done = db.sessions.filter((s) => s.status === "done").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const last = done[0];
  const recent3 = done.slice(0, 3).map((s) => s.overall ?? 0);
  const form = recent3.length ? Math.round(recent3.reduce((a, b) => a + b, 0) / recent3.length) : null;
  const diag = db.diagnoses.at(-1);
  const openDrills = db.drills.filter((d) => d.status === "open").slice(-4).reverse();
  const next = nextInterview(db, day);
  const nextJob = next && db.jobs.find((j) => j.id === next.jobId);
  const plan = todayPlan(db, day);
  const weekAgo = addDays(day, -7);
  const practiceThisWeek = db.attempts.filter((a) => a.createdAt >= weekAgo).length + db.sessions.filter((s) => s.createdAt >= weekAgo).length;
  const newMatches = db.finder.results.filter((j) => j.status === "new" && j.fit.score >= 60).length;
  const first = (db.profile.name || user.name).split(" ")[0];

  const steps = [
    { done: !!settings.keys.anthropic, label: user.role === "admin" ? "Add your Claude API key" : "Ask the admin to add a Claude API key", href: "/integrations" },
    { done: !!(db.profile.germanLevel || db.profile.visaStatus), label: "Fill in your profile (German level, visa, cities)", href: "/settings" },
    { done: db.resumes.length > 0, label: "Upload your CV", href: "/cv" },
    { done: db.jobs.length > 0, label: "Add a job ad, or find one with the Job finder", href: "/finder" },
    { done: db.stories.length >= 4, label: "Build your story bank", href: "/stories" },
    { done: done.length > 0, label: "Do your first mock interview", href: "/interview/new" },
    { done: db.applications.length >= 5, label: "Log your real applications (at least 5)", href: "/applications" },
  ];
  const pending = steps.filter((s) => !s.done);

  return (
    <div className="space-y-6">
      <section className="hero relative overflow-hidden rounded-3xl p-6 shadow-lift sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="text-sm text-white/70">{greeting()}, {first}</div>
            {next ? (
              <>
                <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight sm:text-4xl">
                  {daysUntil(next.nextInterviewDate!, day) === 0 ? "Interview today" : `${daysUntil(next.nextInterviewDate!, day)} day${daysUntil(next.nextInterviewDate!, day) === 1 ? "" : "s"} to your ${next.company} interview`}
                </h1>
                <p className="mt-2 max-w-xl text-white/80">{next.role} · {fmtDate(next.nextInterviewDate!)}. Today’s plan below is built around it.</p>
              </>
            ) : (
              <>
                <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight sm:text-4xl">Let’s find out what’s costing you the offer.</h1>
                <p className="mt-2 max-w-xl text-white/80">Practise for the exact jobs you apply to, fix the weak answers, and let the diagnosis show the real bottleneck.</p>
              </>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <LinkButton href={nextJob ? `/interview/new?job=${nextJob.id}` : "/interview/new"} variant="light" icon="mic">Start a mock interview</LinkButton>
              <Link href="/practice" className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
                <Icon name="bolt" /> 10-minute drill
              </Link>
              {nextJob && (
                <Link href={`/jobs/${nextJob.id}/prep`} className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
                  <Icon name="clipboard" /> Prep pack
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-5">
            <ScoreRing score={form} size={120} stroke={9} label="form" light />
            <div className="space-y-1 text-sm text-white/80">
              <div><b className="text-white">{done.length}</b> mock interviews</div>
              <div><b className="text-white">{practiceThisWeek}</b> practice reps this week</div>
              <div><b className="text-white">{db.applications.length}</b> applications logged</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
        <Card title="Today" icon="flame">
          {plan.length === 0 ? (
            <p className="text-sm text-muted">Finish the setup steps and your daily plan appears here.</p>
          ) : (
            <ul className="space-y-2">
              {plan.map((p) => (
                <li key={p.id}>
                  <Link href={p.href} className={`group flex items-center gap-3 rounded-xl border p-3 transition ${p.done ? "border-transparent bg-surface-2/60" : "border-line hover:border-accent hover:shadow-card"}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${p.done ? "bg-good-soft text-good" : "bg-accent-soft text-accent"}`}>
                      <Icon name={p.done ? "check" : p.id === "german" ? "globe" : p.id === "redo" ? "bolt" : p.id === "stories" ? "book" : p.id === "prep" ? "clipboard" : "mic"} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-medium ${p.done ? "text-muted line-through" : ""}`}>{p.label}</span>
                      <span className="block text-xs text-muted">{p.detail}</span>
                    </span>
                    {!p.done && <Icon name="arrow" className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 self-start">
          <Link href="/finder"><Stat icon="search" label="Strong job matches" value={newMatches} hint="fit 60+ not yet reviewed" /></Link>
          <Link href="/german"><Stat icon="globe" label="German due" value={duePhrases(db.phrases, day).length} hint={`${db.phrases.length} in deck`} /></Link>
          <Link href="/stories"><Stat icon="book" label="Stories" value={db.stories.length} hint={`${storyCoverage(db.stories).gaps.length} gaps`} /></Link>
          <Link href="/debrief"><Stat icon="clipboard" label="Real debriefs" value={db.debriefs.length} hint="interviews analysed" /></Link>
        </div>
      </div>

      {pending.length > 0 && (
        <Card title={`Setup · ${steps.length - pending.length}/${steps.length}`} icon="sparkle">
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${((steps.length - pending.length) / steps.length) * 100}%` }} /></div>
          <ol className="grid gap-2 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${s.done ? "bg-good-soft text-good" : "bg-surface-2 text-muted"}`}>
                  {s.done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {s.done ? <span className="text-muted line-through">{s.label}</span> : <Link href={s.href} className="underline decoration-line underline-offset-4 hover:text-accent">{s.label}</Link>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Last session" icon="mic">
          {last ? (
            <Link href={`/sessions/${last.id}`} className="flex items-center gap-4">
              <ScoreRing score={last.overall} size={72} />
              <div className="min-w-0">
                <div className="truncate font-medium">{db.jobs.find((j) => j.id === last.jobId)?.parsed.title ?? "Job"}</div>
                <div className="text-sm text-muted">{fmtDate(last.createdAt)}</div>
                {last.verdict && <div className="mt-1"><Pill tone={VERDICT_TONE[last.verdict]}>Verdict: {VERDICT_LABEL[last.verdict]}</Pill></div>}
              </div>
            </Link>
          ) : (
            <p className="text-sm text-muted">No scored sessions yet.</p>
          )}
        </Card>

        <Card title="Diagnosis" icon="stethoscope" className="lg:col-span-2" action={<Link href="/diagnosis" className="text-sm text-accent underline">Open</Link>}>
          {diag ? (
            <div>
              <p className="font-serif text-xl leading-snug">{diag.headline}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {diag.causes.slice(0, 3).map((c) => (
                  <li key={c.rank} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-xs">{c.rank}</span> {c.title}
                    <Pill tone={c.confidence === "high" ? "bad" : c.confidence === "medium" ? "warn" : "neutral"}>{c.confidence}</Pill>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Generated {fmtDate(diag.createdAt)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Log a few real applications, do 2–3 mock interviews and debrief your real ones, then run the diagnosis to see why offers aren’t coming.</p>
          )}
        </Card>
      </div>

      <Card title="Readiness by job" icon="target">
        {db.jobs.length === 0 ? (
          <Empty title="No job ads yet" href="/finder" cta="Find matching jobs" icon="search">Each job ad is its own practice track with unlimited sessions.</Empty>
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
                    <span className="hidden text-muted sm:inline">{r.reason}</span>
                    {r.ready ? <Pill tone="good">Interview-ready</Pill> : <Pill tone="warn">Practising</Pill>}
                    <ScoreBadge score={r.avg} size="sm" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {openDrills.length > 0 && (
        <Card title="Open drills" icon="bolt" action={<Link href="/progress" className="text-sm text-accent underline">All drills</Link>}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {openDrills.map((d) => (
              <li key={d.id} className="rounded-xl bg-surface-2/60 p-3 text-sm">
                <div className="font-medium">{d.title}</div>
                <div className="mt-0.5 text-muted">{COMPETENCY_LABELS[d.skill]} · {d.detail}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
