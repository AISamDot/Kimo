import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/client";
import { PrintButton } from "@/components/PrintButton";
import { Card, Empty, Icon, PageHeader, fmtDate } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { daysUntil, today } from "@/lib/practice";
import { readDb } from "@/lib/store";

export const metadata = { title: "Prep pack" };

export default async function PrepPage({ params }: PageProps<"/jobs/[id]/prep">) {
  const user = await requireUser();
  const { id } = await params;
  const db = await readDb(user.id);
  const job = db.jobs.find((j) => j.id === id);
  if (!job) notFound();
  const p = job.prepPack;
  const app = db.applications.find((a) => a.jobId === id && a.nextInterviewDate);
  const days = app?.nextInterviewDate ? daysUntil(app.nextInterviewDate, today()) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Prep pack · ${job.parsed.company}`}
        title={job.parsed.title}
        sub={
          <>
            Everything to rehearse for this interview on one page.{" "}
            {days != null && days >= 0 && <b className="text-ink">Interview in {days} day{days === 1 ? "" : "s"}.</b>}
          </>
        }
        action={
          <>
            <Link href={`/jobs/${id}`} className="inline-flex items-center rounded-xl border border-line bg-surface px-4 py-2 text-sm hover:bg-surface-2">Back to job</Link>
            {p && <PrintButton />}
            <span className="no-print">
              <ActionButton url={`/api/jobs/${id}/prep`} variant={p ? "ghost" : "primary"} busyLabel="Building your prep pack…">
                {p ? "Rebuild" : "Build prep pack"}
              </ActionButton>
            </span>
          </>
        }
      />
      {!p ? (
        <Empty title="No prep pack yet" icon="clipboard">
          One click builds your pitch in English and German, the 8 most likely questions mapped to your stories, salary and visa answers, questions to ask, and job-specific German phrases. Uses your story bank and your mock-interview weak points.
        </Empty>
      ) : (
        <>
          <p className="text-xs text-muted">Built {fmtDate(p.createdAt)}</p>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Your 60-second pitch · English" icon="mic">
              <p className="whitespace-pre-line leading-relaxed">{p.pitchEn}</p>
            </Card>
            <Card title="Ihr Pitch · Deutsch" icon="globe">
              <p className="whitespace-pre-line leading-relaxed">{p.pitchDe}</p>
            </Card>
          </div>
          <Card title="Why this company" icon="target">
            <p className="leading-relaxed">{p.whyThisCompany}</p>
          </Card>
          <Card title="The 8 questions to rehearse" icon="list">
            <ol className="grid gap-4 md:grid-cols-2">
              {p.topQuestions.map((q, i) => (
                <li key={i} className="rounded-xl border border-line bg-surface-2/50 p-4">
                  <div className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink">{i + 1}</span>
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold">{q.q}</p>
                      <p className="mt-1 text-muted">{q.why}</p>
                      <p className="mt-2"><b>Use:</b> {q.story}</p>
                      <ul className="mt-1 list-disc pl-5">{q.keyPoints.map((k, j) => <li key={j}>{k}</li>)}</ul>
                      <Link href={`/practice?q=${encodeURIComponent(q.q)}`} className="no-print mt-2 inline-flex items-center gap-1 text-accent underline">
                        <Icon name="bolt" className="h-3.5 w-3.5" /> Drill this
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Salary" icon="chart"><p className="text-sm leading-relaxed">{p.salaryScript}</p></Card>
            <Card title="Visa / work permit" icon="clipboard"><p className="text-sm leading-relaxed">{p.visaScript}</p></Card>
            <Card title="“How good is your German?”" icon="globe"><p className="text-sm leading-relaxed">{p.germanAnswerScript}</p></Card>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card
              title="German phrases for this job"
              icon="globe"
              action={
                <span className="no-print">
                  <ActionButton url="/api/phrases" body={{ add: p.germanPhrases, source: "job" }} variant="ghost" busyLabel="Adding…">
                    Add all to trainer
                  </ActionButton>
                </span>
              }
            >
              <ul className="divide-y divide-line text-sm">
                {p.germanPhrases.map((g, i) => (
                  <li key={i} className="py-2">
                    <div className="font-medium">{g.de}</div>
                    <div className="text-muted">{g.en}</div>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="space-y-6">
              <Card title="Questions to ask them" icon="chat">
                <ul className="list-disc space-y-1 pl-5 text-sm">{p.questionsToAsk.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </Card>
              <Card title="Don’t say" icon="x">
                <ul className="list-disc space-y-1 pl-5 text-sm">{p.avoid.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </Card>
              <Card title="Day-before checklist" icon="check">
                <ul className="space-y-1.5 text-sm">
                  {p.checklist.map((x, i) => (
                    <li key={i} className="flex gap-2"><span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-line" />{x}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
