import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart, SERIES_COLORS } from "@/components/charts";
import { ActionButton } from "@/components/client";
import { JobReviewRunner } from "@/components/JobReviewRunner";
import { Card, LinkButton, PageHeader, Pill, ScoreBadge, VERDICT_LABEL, VERDICT_TONE, fmtDate } from "@/components/ui";
import { PERSONAS } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { readiness } from "@/lib/metrics";
import { getSettings, readDb } from "@/lib/store";
import { COMPETENCY_LABELS } from "@/lib/types";

export default async function JobPage({ params, searchParams }: PageProps<"/jobs/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const db = await readDb(user.id);
  const job = db.jobs.find((j) => j.id === id);
  if (!job) notFound();
  const p = job.parsed;
  const resumes = [...db.resumes].sort((a, b) => b.version - a.version);
  const reviews = db.jobReviews.filter((r) => r.jobId === id);
  const review = reviews.find((r) => r.resumeId === sp.cv) ?? reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const reviewCv = review && db.resumes.find((r) => r.id === review.resumeId);
  const sessions = db.sessions.filter((s) => s.jobId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const done = sessions.filter((s) => s.status === "done");
  const r = readiness(sessions, (await getSettings()).readiness);

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.title}
        sub={`${p.company} · ${p.location} · ${p.seniority} · ${p.workModel}`}
        action={
          <div className="flex gap-2">
            <LinkButton href={`/interview/new?job=${id}`}>Practise this job</LinkButton>
            <ActionButton url={`/api/jobs/${id}`} method="DELETE" variant="danger" confirm="Delete this job ad and all its practice sessions?" redirectTo="/jobs">
              Delete
            </ActionButton>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Readiness">
          <div className="flex items-center gap-4">
            <ScoreBadge score={r.avg} size="lg" />
            <div className="text-sm">
              {r.ready ? <Pill tone="good">Interview-ready</Pill> : <Pill tone="warn">Not yet</Pill>}
              <p className="mt-1 text-muted">{r.reason}</p>
            </div>
          </div>
        </Card>
        <Card title="Language bar" className="lg:col-span-2">
          <p className="text-sm">
            <b>German:</b> stated “{p.germanRequired.stated}”, realistically needed <Pill tone="accent">{p.germanRequired.implied}</Pill>
          </p>
          <p className="mt-1 text-sm text-muted">{p.germanRequired.reasoning}</p>
          <p className="mt-2 text-sm">
            <b>English:</b> {p.englishRequired}
          </p>
          {p.hygieneNotes && <p className="mt-2 text-sm text-muted">{p.hygieneNotes}</p>}
        </Card>
      </div>

      {done.length > 0 && (
        <Card title="Score trend on this job">
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
      )}

      <Card title="Sessions">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">No practice yet. Unlimited sessions per job; questions change each time.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...sessions].reverse().map((s) => (
              <li key={s.id}>
                <Link href={s.status === "live" ? `/interview/${s.id}` : `/sessions/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm hover:text-accent">
                  <span>
                    {fmtDate(s.createdAt)} · {PERSONAS[s.type].label} · {s.language.toUpperCase()} · {s.difficulty}
                  </span>
                  <span className="flex items-center gap-2">
                    {s.status !== "done" && <Pill tone={s.status === "failed" ? "bad" : "warn"}>{s.status}</Pill>}
                    {s.verdict && <Pill tone={VERDICT_TONE[s.verdict]}>{VERDICT_LABEL[s.verdict]}</Pill>}
                    <ScoreBadge score={s.overall} size="sm" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="CV fit for this ad" action={<JobReviewRunner jobId={id} resumes={resumes.map((x) => ({ id: x.id, label: x.label }))} defaultId={review?.resumeId} />}>
        {!review ? (
          <p className="text-sm text-muted">Run the review to see how your CV matches each requirement.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <ScoreBadge score={review.result.fitScore} size="lg" />
              <div className="text-sm">
                <div className="mb-1 flex flex-wrap gap-1.5">
                  <Pill>{reviewCv?.label}</Pill>
                  <Pill tone={review.result.wouldGetScreen === "likely" ? "good" : review.result.wouldGetScreen === "maybe" ? "warn" : "bad"}>
                    Recruiter screen: {review.result.wouldGetScreen}
                  </Pill>
                  <Pill>Keywords {review.result.keywordCoverage}%</Pill>
                </div>
                <p>{review.result.verdict}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-2 pr-3">Requirement</th>
                    <th className="py-2 pr-3">Evidence in CV</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Fix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {review.result.requirements.map((q, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3 font-medium">{q.requirement}</td>
                      <td className="py-2 pr-3 text-muted">{q.evidence}</td>
                      <td className="py-2 pr-3">
                        <Pill tone={q.status === "clear" ? "good" : q.status === "weak" ? "warn" : "bad"}>{q.status}</Pill>
                      </td>
                      <td className="py-2">{q.status === "clear" ? "" : q.fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {review.result.missingKeywords.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Missing keywords</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {review.result.missingKeywords.map((k) => (
                    <Pill key={k} tone="warn">
                      {k}
                    </Pill>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold">Bullets rewritten for this ad</h3>
              <ul className="mt-2 space-y-3 text-sm">
                {review.result.bulletRewrites.map((b, i) => (
                  <li key={i}>
                    <div className="text-muted line-through">{b.original}</div>
                    <div className="font-medium">{b.improved}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">What interviewers will press on</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {review.result.interviewRisks.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Cover letter tips</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {review.result.coverLetterTips.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Requirements">
          <h3 className="text-sm font-semibold">Must-have</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{p.mustHave.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <h3 className="mt-3 text-sm font-semibold">Nice to have</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{p.niceToHave.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.competencies.map((c) => (
              <Pill key={c} tone="accent">
                {COMPETENCY_LABELS[c]}
              </Pill>
            ))}
          </div>
        </Card>
        <Card title="Likely questions for this ad">
          <ol className="list-decimal space-y-1 pl-5 text-sm">{p.likelyQuestions.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </Card>
      </div>
    </div>
  );
}
