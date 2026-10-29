import { InterviewSetup } from "@/components/InterviewSetup";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSettings, readDb } from "@/lib/store";

export default async function NewInterview({ searchParams }: PageProps<"/interview/new">) {
  const user = await requireUser();
  const db = await readDb(user.id);
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Practise" title="Mock interview" sub="A live two-way interview by voice. Start any time: pick a real job ad, one of 20 leading logistics and supply-chain companies, or just go. Your CV is optional. Every interview is saved with its full report in the Interview log."
        action={<LinkButton href="/sessions" variant="ghost" icon="chat">Interview log ({db.sessions.length})</LinkButton>} />
      <Card>
        <InterviewSetup
          jobs={[...db.jobs].filter((j) => !j.general).reverse().map((j) => ({ id: j.id, label: `${j.parsed.title} — ${j.parsed.company}` }))}
          resumes={[...db.resumes].sort((a, b) => b.version - a.version).map((r) => ({ id: r.id, label: r.label }))}
          defaultJob={typeof sp.job === "string" && !db.jobs.find((j) => j.id === sp.job)?.general ? sp.job : undefined}
          defaultCompany={typeof sp.job === "string" ? db.jobs.find((j) => j.id === sp.job)?.general?.companyId : typeof sp.company === "string" ? sp.company : undefined}
          hasKey={!!s.keys.anthropic}
        />
      </Card>
      <p className="text-xs text-muted">
        Voice: {s.tts === "browser" ? "browser voice (free)" : s.tts} · Speech-to-text: {s.stt === "browser" ? "browser (free)" : s.stt} · Avatar: {s.avatar} · Webcam analysis: {s.features.webcam ? "on" : "off"}. Change these on Integrations.
      </p>
    </div>
  );
}
