import Link from "next/link";
import { ActionButton } from "@/components/client";
import { UploadForm } from "@/components/UploadForm";
import { Card, Empty, PageHeader, Pill, ScoreBadge, fmtDate } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readDb } from "@/lib/store";

export default async function CvPage({ searchParams }: PageProps<"/cv">) {
  const user = await requireUser();
  const db = await readDb(user.id);
  const sp = await searchParams;
  const resumes = [...db.resumes].sort((a, b) => b.version - a.version);
  const selected = resumes.find((r) => r.id === sp.id) ?? resumes[0];
  const rv = selected?.generalReview;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Prepare" title="Your CV" sub="Upload each version you use. Every interview and application is linked to a version, so you can see which one works better." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Add a CV version">
            <UploadForm endpoint="/api/resumes" kind="cv" redirectBase="/cv" />
          </Card>
          {resumes.length > 0 && (
            <Card title="Versions">
              <ul className="space-y-1">
                {resumes.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/cv?id=${r.id}`}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${r.id === selected?.id ? "bg-accent-soft text-accent" : "hover:bg-surface-2"}`}
                    >
                      <span>
                        {r.label} <span className="text-muted">· {fmtDate(r.createdAt)}</span>
                      </span>
                      {r.generalReview && <ScoreBadge score={r.generalReview.overallScore} size="sm" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {!selected ? (
            <Empty title="No CV yet">Upload your CV to get a review and to personalise your mock interviews.</Empty>
          ) : (
            <>
              <Card
                title={`${selected.label} — ${selected.parsed.name || "CV"}`}
                action={
                  <div className="flex gap-2">
                    <ActionButton url={`/api/resumes/${selected.id}/review`} busyLabel="Reviewing… (about a minute)">
                      {rv ? "Re-run review" : "Review this CV"}
                    </ActionButton>
                    <ActionButton url={`/api/resumes/${selected.id}`} method="DELETE" variant="danger" confirm="Delete this CV version?" redirectTo="/cv">
                      Delete
                    </ActionButton>
                  </div>
                }
              >
                <p className="text-sm text-muted">{selected.parsed.headline || selected.parsed.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selected.parsed.languages.map((l) => (
                    <Pill key={l.language}>
                      {l.language}: {l.level || "level not stated"}
                    </Pill>
                  ))}
                  <Pill tone={selected.parsed.workPermit ? "good" : "warn"}>{selected.parsed.workPermit ? `Work permit: ${selected.parsed.workPermit}` : "No work-permit line"}</Pill>
                </div>
                <p className="mt-3 text-sm">
                  {selected.parsed.experience.length} roles · {selected.parsed.skills.length + selected.parsed.tools.length} skills/tools listed
                </p>
                <p className="mt-2 text-xs text-muted">For a review against a specific job, open that job ad.</p>
              </Card>

              {rv && (
                <>
                  <Card title="General review">
                    <div className="flex items-start gap-4">
                      <ScoreBadge score={rv.overallScore} size="lg" />
                      <div className="space-y-2 text-sm">
                        <p>{rv.verdict}</p>
                        <p className="text-muted">
                          <b className="text-ink">Positioning:</b> {rv.positioning}
                        </p>
                      </div>
                    </div>
                    <h3 className="mt-5 font-semibold">Do these first</h3>
                    <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                      {rv.topActions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ol>
                    <h3 className="mt-5 font-semibold">Strengths</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {rv.strengths.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </Card>
                  <Card title="German CV conventions">
                    <ul className="divide-y divide-line text-sm">
                      {rv.germanConventions.map((c, i) => (
                        <li key={i} className="flex items-start gap-3 py-2">
                          <Pill tone={c.status === "ok" ? "good" : c.status === "weak" ? "warn" : "bad"}>{c.status}</Pill>
                          <div>
                            <div className="font-medium">{c.item}</div>
                            {c.status !== "ok" && <div className="text-muted">{c.fix}</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  {rv.redFlags.length > 0 && (
                    <Card title="Red flags">
                      <ul className="space-y-2 text-sm">
                        {rv.redFlags.map((f, i) => (
                          <li key={i}>
                            <span className="font-medium text-bad">{f.issue}</span> — {f.fix}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                  <Card title="Stronger bullets">
                    <p className="mb-3 text-xs text-muted">Replace [X] with your real numbers. Never invent numbers you can’t defend in an interview.</p>
                    <ul className="space-y-4 text-sm">
                      {rv.bulletRewrites.map((b, i) => (
                        <li key={i}>
                          <div className="text-muted line-through">{b.original}</div>
                          <div className="font-medium">{b.improved}</div>
                          <div className="text-xs text-muted">{b.why}</div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
