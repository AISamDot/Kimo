import Link from "next/link";
import { ActionButton } from "@/components/client";
import { DebriefForm } from "@/components/DebriefForm";
import { Card, Icon, PageHeader, Pill, VERDICT_LABEL, VERDICT_TONE, fmtDate } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { STAGE_LABELS } from "@/lib/types";
import { RunningNote } from "@/components/TaskTray";

export const metadata = { title: "Real interviews" };

export default async function DebriefPage() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const list = [...db.debriefs].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Track"
        title="Real interview debriefs"
        sub="Right after each real interview, write down what they asked and what you answered. You get an honest read of how it went and better answers, and the diagnosis learns from real interviews, not only mocks."
      />
      <RunningNote kinds={["debrief"]} />
      <DebriefForm apps={db.applications.filter((a) => a.outcome === "active" || a.outcome === "rejected").map((a) => ({ id: a.id, label: `${a.company} · ${a.role}` }))} />
      {list.map((d) => {
        const app = db.applications.find((a) => a.id === d.applicationId);
        const r = d.result;
        return (
          <Card
            key={d.id}
            title={
              <span className="normal-case tracking-normal">
                <span className="font-serif text-lg font-semibold text-ink">{app ? `${app.company} · ${app.role}` : "Interview"}</span>
                <span className="ml-2 text-sm font-normal text-muted">{fmtDate(d.date)} · {STAGE_LABELS[d.stage]} · {d.language.toUpperCase()}</span>
              </span>
            }
            action={<ActionButton url={`/api/debriefs?id=${d.id}`} method="DELETE" variant="danger" confirm="Delete this debrief?">Delete</ActionButton>}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={VERDICT_TONE[r.likelyVerdict]}>Likely: {VERDICT_LABEL[r.likelyVerdict]}</Pill>
              <Pill>You felt {d.feeling}/5</Pill>
            </div>
            <p className="mt-3 leading-relaxed">{r.summary}</p>
            {r.redFlags.length > 0 && (
              <div className="mt-4 rounded-xl bg-bad-soft p-3 text-sm text-bad">
                <b>Red flags:</b>
                <ul className="mt-1 list-disc pl-5">{r.redFlags.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {r.perQuestion.map((q, i) => (
                <details key={i} className="rounded-xl border border-line p-3 text-sm">
                  <summary className="flex cursor-pointer items-center gap-3">
                    <Pill tone={q.score >= 4 ? "good" : q.score === 3 ? "warn" : "bad"}>{q.score}/5</Pill>
                    <span className="font-medium">{q.q}</span>
                  </summary>
                  <p className="mt-2 text-muted">{q.assessment}</p>
                  <div className="mt-2 rounded-lg bg-accent-soft p-3"><b className="text-accent">Better:</b> {q.betterAnswer}</div>
                  <Link href={`/practice?q=${encodeURIComponent(q.q)}`} className="mt-2 inline-flex items-center gap-1 text-accent underline">
                    <Icon name="bolt" className="h-3.5 w-3.5" /> Drill this question
                  </Link>
                </details>
              ))}
            </div>
            <div className="mt-4 text-sm">
              <b>Practise next:</b>
              <ul className="mt-1 list-disc pl-5">{r.whatToPractise.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
