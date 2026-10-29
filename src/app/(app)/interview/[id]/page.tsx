import { notFound, redirect } from "next/navigation";
import { InterviewRoom } from "@/components/InterviewRoom";
import { PERSONAS } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { getSettings, readSession } from "@/lib/store";

export default async function LiveInterview({ params }: PageProps<"/interview/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const s = await readSession(user.id, id);
  if (!s) notFound();
  if (s.status !== "live") redirect(`/sessions/${id}`);
  const settings = await getSettings();
  const last = s.turns.at(-1);
  return (
    <InterviewRoom
      sessionId={s.id}
      type={s.type}
      typeLabel={PERSONAS[s.type].label}
      interviewerName={s.plan.interviewerName}
      interviewerTitle={s.plan.interviewerTitle}
      lengthMin={s.lengthMin}
      turns={s.turns.map((t) => ({ speaker: t.speaker, text: t.text, lang: t.lang, kind: t.kind }))}
      elapsedMs={last ? last.atMs + last.durationMs : 0}
      config={{
        stt: settings.stt,
        tts: settings.tts,
        avatar: settings.avatar === "tavus" && !settings.keys.tavus ? "animated" : settings.avatar,
        webcam: settings.features.webcam,
        silenceMs: settings.interview.silenceMs,
        pressureMaxAnswerSec: settings.interview.pressureMaxAnswerSec,
      }}
    />
  );
}
