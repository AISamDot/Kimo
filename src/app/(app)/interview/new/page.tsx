import { InterviewSetup } from "@/components/InterviewSetup";
import { Card, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSettings, readDb } from "@/lib/store";

export default async function NewInterview({ searchParams }: PageProps<"/interview/new">) {
  const user = await requireUser();
  const db = await readDb(user.id);
  const sp = await searchParams;
  const s = await getSettings();
  if (!db.resumes.length) return <Empty title="Upload your CV first" href="/cv" cta="Go to CV">The interviewer asks about your real experience, so it needs your CV.</Empty>;
  if (!db.jobs.length) return <Empty title="Add a job ad first" href="/jobs" cta="Add a job ad">Interviews are tailored to a specific job ad.</Empty>;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Practise" title="Mock interview" sub="A live two-way interview by voice, tailored to the job ad and your CV. You get a scored report afterwards." />
      <Card>
        <InterviewSetup
          jobs={[...db.jobs].reverse().map((j) => ({ id: j.id, label: `${j.parsed.title} — ${j.parsed.company}` }))}
          resumes={[...db.resumes].sort((a, b) => b.version - a.version).map((r) => ({ id: r.id, label: r.label }))}
          defaultJob={typeof sp.job === "string" ? sp.job : undefined}
          hasKey={!!s.keys.anthropic}
        />
      </Card>
      <p className="text-xs text-muted">
        Voice: {s.tts === "browser" ? "browser voice (free)" : s.tts} · Speech-to-text: {s.stt === "browser" ? "browser (free)" : s.stt} · Avatar: {s.avatar} · Webcam analysis: {s.features.webcam ? "on" : "off"}. Change these on Integrations.
      </p>
    </div>
  );
}
