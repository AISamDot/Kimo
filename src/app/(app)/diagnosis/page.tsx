import { ActionButton } from "@/components/client";
import { Card, PageHeader, Pill, fmtDate } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { RunningNote } from "@/components/TaskTray";

const AREA: Record<string, string> = {
  cv: "CV",
  content: "Interview content",
  delivery: "Delivery",
  presence: "Presence",
  german: "German level",
  hygiene: "Visa / salary / logistics",
  targeting: "Role targeting",
  other: "Other",
};

export default async function DiagnosisPage() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const d = db.diagnoses.at(-1);
  const scored = db.sessions.filter((s) => s.status === "done").length;
  const apps = db.applications.length;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Track"
        title="Why no offer yet?"
        sub="Combines your real application funnel, CV reviews and mock-interview scores into a ranked list of causes, each with its evidence and confidence."
        action={<ActionButton url="/api/diagnosis" taskKey="diagnosis" busyLabel="Analysing… (about a minute)">{d ? "Refresh diagnosis" : "Run diagnosis"}</ActionButton>}
      />
      <RunningNote kinds={["diagnosis"]}>Reads all your sessions, debriefs and applications. Takes a minute or two; you can leave this page.</RunningNote>
      {(apps < 5 || scored < 3) && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          For a high-confidence answer, log at least 5 real applications (you have {apps}) and complete at least 3 scored mock interviews (you have {scored}). You can still run it now for a first read.
        </p>
      )}
      {d ? (
        <>
          <Card>
            <p className="text-xs text-muted">Generated {fmtDate(d.createdAt)}</p>
            <p className="mt-1 font-serif text-2xl leading-snug">{d.headline}</p>
            <p className="mt-2 text-sm text-muted">{d.dataSufficiency}</p>
          </Card>
          {d.causes.map((c) => (
            <Card key={c.rank}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-xl font-semibold">#{c.rank}</span>
                <span className="text-lg font-semibold">{c.title}</span>
                <Pill tone="accent">{AREA[c.area]}</Pill>
                <Pill tone={c.confidence === "high" ? "bad" : c.confidence === "medium" ? "warn" : "neutral"}>{c.confidence} confidence</Pill>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold">Evidence</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{c.evidence.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
                <div>
                  <div className="text-sm font-semibold">What to do</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{c.whatToDo.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              </div>
            </Card>
          ))}
          <div className="grid gap-6 sm:grid-cols-2">
            <Card title="Probably not the problem">
              <ul className="list-disc space-y-1 pl-5 text-sm">{d.notTheProblem.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </Card>
            <Card title="Next steps">
              <ol className="list-decimal space-y-1 pl-5 text-sm">{d.nextSteps.map((x, i) => <li key={i}>{x}</li>)}</ol>
            </Card>
          </div>
          <Card title="Check it against a human">
            <p className="text-sm text-muted">
              The AI isn’t a German hiring manager. Once, do a mock interview with a real supply-chain professional (career service, alumni, LinkedIn). If their main criticisms match this page, trust the app for repeated practice.
            </p>
          </Card>
        </>
      ) : (
        <Card>
          <p className="text-sm text-muted">No diagnosis yet. Run it once you have some data; refresh it after new applications or sessions.</p>
        </Card>
      )}
    </div>
  );
}
