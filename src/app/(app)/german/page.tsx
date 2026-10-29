import { PhraseTrainer } from "@/components/PhraseTrainer";
import { PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { duePhrases, masteredCount, today } from "@/lib/practice";
import { readDb } from "@/lib/store";

export const metadata = { title: "German trainer" };

export default async function GermanPage() {
  const user = await requireUser();
  const db = await readDb(user.id);
  const day = today();
  const due = duePhrases(db.phrases, day);
  const reviewedToday = db.phrases.filter((p) => p.reviews > 0 && p.due > day && p.box > 0).length;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practise"
        title="German trainer"
        sub={`Your own interview German: corrections from your mock interviews, phrases from your job ads, and anything you add. Five minutes a day with spaced repetition. Your level: ${db.profile.germanLevel || "not set"}.`}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="flame" label="Due today" value={due.length} />
        <Stat icon="book" label="In your deck" value={db.phrases.length} />
        <Stat icon="star" label="Mastered" value={masteredCount(db.phrases)} hint="box 4+ (a week or longer)" />
        <Stat icon="check" label="Scheduled ahead" value={reviewedToday} />
      </div>
      <PhraseTrainer due={due} all={db.phrases} />
    </div>
  );
}
