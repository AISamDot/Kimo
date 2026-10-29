import { ActionButton } from "@/components/client";
import { StoryBank } from "@/components/StoryBank";
import { Card, PageHeader, Pill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { STORY_COMPETENCIES, storyCoverage } from "@/lib/practice";
import { readDb } from "@/lib/store";
import { COMPETENCY_LABELS } from "@/lib/types";
import { RunningNote } from "@/components/TaskTray";

export const metadata = { title: "Story bank" };

export default async function StoriesPage() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const { count, gaps } = storyCoverage(db.stories);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Prepare"
        title="Story bank"
        sub="8–10 strong STAR stories answer almost every behavioural question. Build them once, rehearse them, reuse them in every interview. The interviewer, the scoring and the prep packs all use these."
        action={
          db.resumes.length > 0 && (
            <ActionButton url="/api/stories" body={{ mine: true }} taskKey="stories:mine" busyLabel="Drafting from your CV…">
              Draft stories from my CV
            </ActionButton>
          )
        }
      />
      <RunningNote kinds={["stories"]} />
      <Card title="Coverage" icon="target">
        <div className="flex flex-wrap gap-2">
          {STORY_COMPETENCIES.map((c) => (
            <Pill key={c} tone={count[c] >= 2 ? "good" : count[c] === 1 ? "accent" : "bad"}>
              {COMPETENCY_LABELS[c]} · {count[c]}
            </Pill>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          {gaps.length ? `No story yet for: ${gaps.map((g) => COMPETENCY_LABELS[g]).join(", ")}.` : "Every competency has at least one story. Now make each one specific and measurable."}
        </p>
      </Card>
      <StoryBank stories={db.stories} />
    </div>
  );
}
