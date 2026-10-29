import Link from "next/link";
import { Empty, LinkButton, PageHeader, Pill, ScoreBadge, VERDICT_LABEL, VERDICT_TONE, fmtDate } from "@/components/ui";
import { PERSONAS } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { readDb, readSession } from "@/lib/store";

export const metadata = { title: "Interview log" };

const STATUS = {
  live: { label: "Not finished", tone: "warn" },
  analyzing: { label: "Scoring…", tone: "accent" },
  failed: { label: "Scoring failed", tone: "bad" },
  done: { label: "Scored", tone: "good" },
} as const;

// Every mock interview he has started, newest first, with the headline of its report.
export default async function InterviewLog() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const sessions = [...db.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const summaries = new Map(
    await Promise.all(
      sessions
        .filter((s) => s.status === "done")
        .slice(0, 100)
        .map(async (s) => [s.id, (await readSession(user.id, s.id))?.analysis?.report.summary ?? ""] as const),
    ),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practise"
        title="Interview log"
        sub="Every mock interview, with its score and full feedback report. Open one to see answer-by-answer scores, better answers, delivery, language and drills."
        action={<LinkButton href="/interview/new" icon="mic">New interview</LinkButton>}
      />
      {!sessions.length ? (
        <Empty title="No interviews yet" href="/interview/new" cta="Start one now" icon="mic">
          No setup needed: no job ad or CV required.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const job = db.jobs.find((j) => j.id === s.jobId);
            const cv = db.resumes.find((r) => r.id === s.resumeId);
            const st = STATUS[s.status];
            const target = job ? (job.general?.companyId === "any" ? `General interview — ${job.parsed.title.replace(" (general)", "")}` : `${job.parsed.title} — ${job.parsed.company}`) : "Deleted job ad";
            return (
              <li key={s.id}>
                <Link
                  href={s.status === "live" ? `/interview/${s.id}` : `/sessions/${s.id}`}
                  className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:border-accent hover:shadow-lift"
                >
                  <ScoreBadge score={s.overall} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-snug">{target}</div>
                    <div className="text-sm text-muted">
                      {fmtDate(s.createdAt)} · {PERSONAS[s.type].label} · {s.language.toUpperCase()} · {s.difficulty} · {s.lengthMin} min · {cv ? cv.label : "No CV"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Pill tone={st.tone}>{st.label}</Pill>
                      {s.verdict && <Pill tone={VERDICT_TONE[s.verdict]}>{VERDICT_LABEL[s.verdict]}</Pill>}
                      {job?.general && <Pill tone="signal">{job.general.companyId === "any" ? "General" : "Company track"}</Pill>}
                    </div>
                    {summaries.get(s.id) && <p className="mt-2 line-clamp-2 text-sm text-muted">{summaries.get(s.id)}</p>}
                    {s.status === "failed" && s.error && <p className="mt-2 text-sm text-bad">{s.error} Open it to retry the scoring.</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
