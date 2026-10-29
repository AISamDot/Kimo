import { PERSONAS } from "./ai";
import { COMPETENCY_LABELS, type Job, type SessionDetail } from "./types";

const VERDICT: Record<string, string> = { strong_no: "Strong no", no: "No", lean_yes: "Leaning yes", yes: "Yes" };

export function sessionMarkdown(s: SessionDetail, job?: Job): string {
  const a = s.analysis!;
  const r = a.report;
  const L: string[] = [];
  L.push(`# Mock interview report — ${job ? `${job.parsed.title}, ${job.parsed.company}` : "job"}`);
  L.push(`${s.createdAt.slice(0, 10)} · ${PERSONAS[s.type].label} · ${s.language.toUpperCase()} · ${s.difficulty} · ${s.lengthMin} min\n`);
  L.push(`**Overall: ${a.overall}/100 · Hiring verdict: ${VERDICT[r.verdict]}**\n`);
  L.push(r.verdictReason + "\n");
  L.push(`| Area | Score |\n|---|---|`);
  L.push(`| Content | ${a.areaScores.content} |`);
  L.push(`| Delivery | ${a.areaScores.delivery} |`);
  if (a.areaScores.language != null) L.push(`| Language (${a.language?.lang.toUpperCase()}) | ${a.areaScores.language} |`);
  if (a.areaScores.presence != null) L.push(`| Presence | ${a.areaScores.presence} |`);
  L.push(`\n## Summary\n${r.summary}\n`);
  L.push(`## Strengths\n${r.strengths.map((x) => `- ${x}`).join("\n")}\n`);
  L.push(`## Top 3 drills\n${r.drills.map((d, i) => `${i + 1}. **${d.title}** (${COMPETENCY_LABELS[d.skill]}) — ${d.detail}`).join("\n")}\n`);
  if (r.silentRejecters.length) L.push(`## Silent rejecters\n${r.silentRejecters.map((x) => `- ${x}`).join("\n")}\n`);
  if (r.comparison) L.push(`## Versus last session\n${r.comparison}\n`);
  L.push(`## Delivery\n- Pace: ${a.delivery.wpm} words/min\n- Filler words: ${a.delivery.fillersPerMin}/min ${Object.entries(a.delivery.fillerCounts).map(([k, v]) => `${k}×${v}`).join(", ")}\n- Long pauses per answer: ${a.delivery.longPausesPerAnswer}\n- Average answer: ${a.delivery.avgAnswerSec}s (${a.delivery.answerLengthOkPct}% in the target range)\n- Talk-time share: ${a.delivery.talkRatio}%\n`);
  if (a.language) {
    L.push(`## Language (${a.language.lang === "de" ? "German" : "English"})\nEstimated level **${a.language.cefr}** · job needs ${a.language.requiredLevel || "?"} · ${a.language.notes}\n`);
    if (a.language.corrections.length) L.push(a.language.corrections.map((c) => `- ~~${c.said}~~ → ${c.better}`).join("\n") + "\n");
    if (a.language.phrasesToPractice.length) L.push("Phrases to practise:\n" + a.language.phrasesToPractice.map((p) => `- ${p.phrase} — ${p.meaning}`).join("\n") + "\n");
  }
  if (a.presence) L.push(`## Presence (webcam)\n${a.presence.notes.map((n) => `- ${n}`).join("\n") || "- No issues"}\n`);
  L.push(`## Question by question`);
  for (const q of a.answers) {
    L.push(`\n### Q${q.questionNo}. ${q.question}\n*${COMPETENCY_LABELS[q.competency]}* — relevance ${q.relevance}, structure ${q.structure}, specificity ${q.specificity}, ownership ${q.ownership}, depth ${q.domainDepth}, concision ${q.concision}${q.correctness != null ? `, correctness ${q.correctness}` : ""}\n`);
    L.push(`**Your answer:** ${q.answerSummary}`);
    if (q.costlyQuote) L.push(`**Cost you points:** “${q.costlyQuote}”`);
    L.push(`**Missing:** ${q.whatWasMissing}`);
    L.push(`**Stronger answer:** ${q.modelAnswer}`);
  }
  L.push(`\n## Transcript\n${s.turns.map((t) => `**${t.speaker === "interviewer" ? "Interviewer" : "You"}:** ${t.text}`).join("\n\n")}`);
  return L.join("\n");
}
