import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AnalysisPoller } from "@/components/AnalysisPoller";
import { ActionButton } from "@/components/client";
import { PrintButton } from "@/components/PrintButton";
import { Card, LinkButton, Meter, PageHeader, Pill, ScoreBadge, Stat, VERDICT_LABEL, VERDICT_TONE, fmtDate } from "@/components/ui";
import { PERSONAS } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { answerContentScore, fiveToHundred } from "@/lib/metrics";
import { readDb, readSession } from "@/lib/store";
import { COMPETENCY_LABELS } from "@/lib/types";

const DIMS = [
  ["relevance", "Relevance"],
  ["structure", "Structure"],
  ["specificity", "Specificity"],
  ["ownership", "Ownership"],
  ["domainDepth", "Depth"],
  ["concision", "Concision"],
] as const;

export default async function SessionReport({ params }: PageProps<"/sessions/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const s = await readSession(user.id, id);
  if (!s) notFound();
  if (s.status === "live") redirect(`/interview/${id}`);
  const db = await readDb(user.id);
  const job = db.jobs.find((j) => j.id === s.jobId);
  const title = job ? `${job.parsed.title} — ${job.parsed.company}` : "Interview report";
  const sub = `${fmtDate(s.createdAt)} · ${PERSONAS[s.type].label} · ${s.language.toUpperCase()} · ${s.difficulty} · ${s.lengthMin} min`;

  if (s.status === "analyzing") {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Session report" title={title} sub={sub} />
        <AnalysisPoller sessionId={id} />
      </div>
    );
  }
  if (s.status === "failed" || !s.analysis) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Session report" title={title} sub={sub} />
        <Card>
          <p className="text-bad">{s.error ?? "The analysis didn't finish."}</p>
          <div className="mt-4 flex gap-2">
            <ActionButton url={`/api/sessions/${id}/analyze`}>Try the analysis again</ActionButton>
            <ActionButton url={`/api/sessions/${id}`} method="DELETE" variant="danger" confirm="Delete this session?" redirectTo={job ? `/jobs/${job.id}` : "/"}>
              Delete session
            </ActionButton>
          </div>
        </Card>
      </div>
    );
  }

  const a = s.analysis;
  const r = a.report;
  const audioByQ = new Map<number, string[]>();
  for (const t of s.turns) if (t.speaker === "candidate" && t.audioFile && t.questionNo) audioByQ.set(t.questionNo, [...(audioByQ.get(t.questionNo) ?? []), t.audioFile]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        sub={sub}
        action={
          <div className="no-print flex flex-wrap gap-2">
            <LinkButton href={`/interview/new?job=${s.jobId}`}>Practise again</LinkButton>
            <a href={`/api/sessions/${id}/export`} className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2">
              Download .md
            </a>
            <PrintButton />
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap items-start gap-5">
          <ScoreBadge score={a.overall} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Hiring verdict:</span>
              <Pill tone={VERDICT_TONE[r.verdict]}>{VERDICT_LABEL[r.verdict]}</Pill>
            </div>
            <p className="mt-2 font-serif text-lg leading-snug">{r.verdictReason}</p>
            <p className="mt-2 text-sm text-muted">{r.summary}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Content", a.areaScores.content, "What you said"],
              ["Delivery", a.areaScores.delivery, "How you said it"],
              [`Language (${a.language?.lang.toUpperCase() ?? ""})`, a.areaScores.language, a.language ? `≈ ${a.language.cefr}` : ""],
              ["Presence", a.areaScores.presence, a.presence ? "Webcam" : "Webcam off"],
            ] as const
          ).map(([l, v, h]) => (
            <div key={l} className="rounded-xl bg-surface-2 p-3">
              <div className="flex items-center justify-between text-sm">
                <span>{l}</span>
                <span className="font-semibold tabular-nums">{v ?? "–"}</span>
              </div>
              <div className="mt-2">{v != null ? <Meter value={v} /> : <div className="h-2" />}</div>
              <div className="mt-1 text-xs text-muted">{h}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card title="Top 3 things to practise" className="lg:col-span-2">
          <ol className="space-y-3">
            {r.drills.map((d, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink">{i + 1}</span>
                <div className="text-sm">
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-muted">{d.detail}</div>
                  <Pill>{COMPETENCY_LABELS[d.skill]}</Pill>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="What went well">
          <ul className="space-y-2 text-sm">
            {r.strengths.map((x, i) => (
              <li key={i} className="rounded-lg bg-good-soft p-2.5">{x}</li>
            ))}
          </ul>
        </Card>
      </div>

      {r.silentRejecters.length > 0 && (
        <Card title="Silent rejecters">
          <p className="mb-2 text-xs text-muted">Answers about visa, salary, start date, German level or motivation that can end a process without anyone telling you why.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {r.silentRejecters.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Card>
      )}
      {r.comparison && (
        <Card title="Compared with your last session">
          <p className="text-sm">{r.comparison}</p>
        </Card>
      )}

      <Card title="Question by question">
        <div className="divide-y divide-line">
          {a.answers.map((q) => {
            const c = fiveToHundred(answerContentScore(q));
            return (
              <details key={q.questionNo} className="group py-3">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted">
                      Q{q.questionNo} · {COMPETENCY_LABELS[q.competency]}
                    </div>
                    <div className="font-medium">{q.question}</div>
                  </div>
                  <ScoreBadge score={c} size="sm" />
                </summary>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex flex-wrap gap-1.5">
                    {DIMS.map(([k, l]) => (
                      <Pill key={k} tone={q[k] >= 4 ? "good" : q[k] >= 3 ? "warn" : "bad"}>
                        {l} {q[k]}/5
                      </Pill>
                    ))}
                    {q.correctness != null && <Pill tone={q.correctness >= 4 ? "good" : q.correctness >= 3 ? "warn" : "bad"}>Correctness {q.correctness}/5</Pill>}
                  </div>
                  <p>
                    <b>Your answer:</b> {q.answerSummary}
                  </p>
                  {q.costlyQuote && (
                    <p>
                      <b>Cost you points:</b> <span className="text-bad">“{q.costlyQuote}”</span>
                    </p>
                  )}
                  <p>
                    <b>Missing:</b> {q.whatWasMissing}
                  </p>
                  <div className="rounded-xl bg-accent-soft p-3">
                    <div className="text-xs font-semibold text-accent uppercase">A stronger answer from your own experience</div>
                    <p className="mt-1">{q.modelAnswer}</p>
                  </div>
                  {audioByQ.get(q.questionNo)?.map((f) => (
                    <audio key={f} controls preload="none" src={`/api/sessions/${id}/audio/${f}`} className="w-full" />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Delivery">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Pace" value={`${a.delivery.wpm} wpm`} hint={a.language?.lang === "de" ? "target 100–140" : "target 120–160"} />
            <Stat label="Filler words" value={`${a.delivery.fillersPerMin}/min`} hint="target < 3" />
            <Stat label="Long pauses" value={`${a.delivery.longPausesPerAnswer}/answer`} hint="> 3 s mid-answer" />
            <Stat label="Avg answer" value={`${a.delivery.avgAnswerSec}s`} hint={`${a.delivery.answerLengthOkPct}% right length`} />
            <Stat label="Your talk share" value={`${a.delivery.talkRatio}%`} hint="target 55–70%" />
            <Stat label="Trailing off" value={`${a.delivery.trailingOffPct}%`} hint="answers getting quieter" />
          </div>
          {Object.keys(a.delivery.fillerCounts).length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Fillers:{" "}
              {Object.entries(a.delivery.fillerCounts)
                .sort((x, y) => y[1] - x[1])
                .map(([k, v]) => `“${k}” ×${v}`)
                .join(", ")}
            </p>
          )}
          {a.delivery.pitchVariation > 0 && (
            <p className="mt-1 text-sm text-muted">
              Voice variety: {a.delivery.pitchVariation} semitones ({a.delivery.pitchVariation < 2 ? "quite monotone" : a.delivery.pitchVariation > 6 ? "very animated" : "natural range"})
            </p>
          )}
          {a.vocal && (
            <div className="mt-4 border-t border-line pt-3 text-sm">
              <div className="font-semibold">How your voice may come across</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {a.vocal.topExpressions.map((e) => (
                  <Pill key={e.name}>
                    {e.name} {Math.round(e.score * 100)}
                  </Pill>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">{a.vocal.note}</p>
            </div>
          )}
        </Card>

        {a.language && (
          <Card title={a.language.lang === "de" ? "German" : "English"}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Estimated level</span>
              <Pill tone="accent">{a.language.cefr}</Pill>
              <span>· job needs</span>
              <Pill>{a.language.requiredLevel || "?"}</Pill>
              <Pill tone={a.language.gap === "meets" ? "good" : a.language.gap === "one_level" ? "warn" : a.language.gap === "two_plus" ? "bad" : "neutral"}>
                {{ meets: "Meets the bar", one_level: "1 level short", two_plus: "2+ levels short", unknown: "Unclear" }[a.language.gap]}
              </Pill>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              {(
                [
                  ["Fluency", a.language.fluency],
                  ["Grammar", a.language.grammar],
                  ["Vocabulary", a.language.vocabulary],
                  ["Job terms", a.language.domainVocabulary],
                  ["Understanding", a.language.comprehension],
                  ["Pronunciation", a.language.pronunciation],
                ] as const
              ).map(([l, v]) => (
                <div key={l} className="rounded-lg bg-surface-2 p-2">
                  <div className="text-muted">{l}</div>
                  <div className="text-base font-semibold">{v ?? "–"}{v != null && <span className="text-xs text-muted">/5</span>}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm">{a.language.notes}</p>
            {a.pronunciation && (
              <p className="mt-2 text-xs text-muted">
                Azure pronunciation: accuracy {a.pronunciation.accuracy}, fluency {a.pronunciation.fluency}
                {a.pronunciation.prosody != null ? `, prosody ${a.pronunciation.prosody}` : ""} (out of 100)
              </p>
            )}
            {a.language.corrections.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-semibold">Corrections</div>
                <ul className="mt-1 space-y-1 text-sm">
                  {a.language.corrections.map((c, i) => (
                    <li key={i}>
                      <span className="text-bad line-through">{c.said}</span> → <span className="text-good">{c.better}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.language.phrasesToPractice.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-semibold">Phrases to practise</div>
                <ul className="mt-1 space-y-1 text-sm">
                  {a.language.phrasesToPractice.map((x, i) => (
                    <li key={i}>
                      <b>{x.phrase}</b> <span className="text-muted">— {x.meaning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}
      </div>

      {a.presence && (
        <Card title="Presence (webcam, approximate)">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Looking at camera" value={`${a.presence.gazeAtCameraPct}%`} hint="target 60%+" />
            <Stat label="Smiling" value={`${a.presence.smilePct}%`} />
            <Stat label="Head movement" value={a.presence.headMotion < 0.01 ? "Steady" : a.presence.headMotion < 0.03 ? "Some" : "A lot"} />
            <Stat label="Face visible" value={`${a.presence.facePresentPct}%`} />
            <Stat label="Lighting" value={a.presence.brightness < 70 ? "Too dark" : a.presence.brightness > 200 ? "Too bright" : "OK"} />
          </div>
          {a.presence.notes.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {a.presence.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">Observable behaviour only. The app does not guess emotions from your face.</p>
        </Card>
      )}

      {a.costNotes.length > 0 && (
        <p className="text-xs text-muted">{a.costNotes.join(" · ")}</p>
      )}

      <details className="rounded-2xl border border-line bg-surface p-5">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-muted">Full transcript</summary>
        <div className="mt-3 space-y-2 text-sm">
          {s.turns.map((t) => (
            <p key={t.idx}>
              <b className={t.speaker === "interviewer" ? "text-accent" : ""}>{t.speaker === "interviewer" ? s.plan.interviewerName : "You"}:</b> {t.text || <i className="text-muted">(silence)</i>}
            </p>
          ))}
        </div>
      </details>

      <div className="no-print flex flex-wrap gap-2">
        <ActionButton url={`/api/sessions/${id}/analyze`} variant="ghost" busyLabel="Re-scoring…">
          Re-run analysis
        </ActionButton>
        <ActionButton url={`/api/sessions/${id}`} method="DELETE" variant="danger" confirm="Delete this session and its recordings?" redirectTo={job ? `/jobs/${job.id}` : "/"}>
          Delete session
        </ActionButton>
        {job && (
          <Link href={`/jobs/${job.id}`} className="self-center text-sm text-accent underline">
            Back to job track
          </Link>
        )}
      </div>
    </div>
  );
}
