// Instant, free CV checks against widely used best practice (recruiter scan habits, ATS parsing,
// the "accomplished X, measured by Y, by doing Z" bullet formula, German Lebenslauf norms).
// No Claude call: runs on the parsed CV every time the page loads.
import type { Resume } from "./types";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CvCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fix: string;
  weight: number;
}

const WEAK_OPENERS = [
  "responsible for", "helped", "worked on", "assisted", "involved in", "participated in", "tasked with", "duties included", "in charge of", "supported",
  "verantwortlich für", "zuständig für", "mitarbeit", "unterstützung", "beteiligt an", "mitgewirkt",
];
const CLICHES = [
  "team player", "hard-working", "hardworking", "detail-oriented", "detail oriented", "self-motivated", "highly motivated", "results-driven", "results driven",
  "dynamic", "go-getter", "think outside the box", "passionate", "synergy", "teamfähig", "belastbar", "zuverlässig", "motiviert", "flexibel",
];
const PRONOUN = /(^|[\s,(])(i|my|me|ich|mein|meine|meinen|mir)(?=[\s,.)'’]|$)/i;
const NUMBER = /(\d|%|€|\$|£)/;
const CEFR = /\b(a1|a2|b1|b2|c1|c2|native|mother tongue|muttersprache|verhandlungssicher)\b/i;
const ERP = /\b(sap|s\/4hana|s4hana|oracle|dynamics|erp|navision|jd edwards|infor|power bi|tableau|sql|python|excel)\b/i;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, mär: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12,
};

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Month index (year*12+month) from "03/2024", "2024-03", "Mar 2024", "März 2024", "2024"; Infinity for "present". */
export function monthIndex(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/present|current|now|heute|aktuell|today|ongoing|laufend|bis jetzt/.test(s)) return Infinity;
  let m = s.match(/^(\d{1,2})[./-](\d{4})$/);
  if (m) return +m[2] * 12 + +m[1];
  m = s.match(/^(\d{4})[./-](\d{1,2})$/);
  if (m) return +m[1] * 12 + +m[2];
  m = s.match(/^([a-zäöü]{3})[a-zäöü]*\.?\s+(\d{4})$/);
  if (m && MONTHS[m[1]]) return +m[2] * 12 + MONTHS[m[1]];
  m = s.match(/^(\d{4})$/);
  if (m) return +m[1] * 12 + 1;
  return null;
}

function dateShape(raw: string) {
  const s = raw.trim().toLowerCase();
  if (/^\d{1,2}[./-]\d{4}$/.test(s)) return "MM/YYYY";
  if (/^\d{4}[./-]\d{1,2}$/.test(s)) return "YYYY-MM";
  if (/^[a-zäöü]{3,}\.?\s+\d{4}$/.test(s)) return "Mon YYYY";
  if (/^\d{4}$/.test(s)) return "YYYY";
  return "other";
}

export function runCvChecks(resume: Resume): { checks: CvCheck[]; score: number } {
  const p = resume.parsed;
  const text = resume.text || "";
  const roles = p.experience ?? [];
  const bullets = roles.flatMap((r) => r.bullets ?? []).map((b) => b.trim()).filter(Boolean);
  const checks: CvCheck[] = [];
  const add = (c: CvCheck) => checks.push(c);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  // 1. Quantified impact
  const quantified = bullets.filter((b) => NUMBER.test(b)).length;
  const qPct = pct(quantified, bullets.length);
  add({
    id: "quantified", label: "Achievements are quantified", weight: 3,
    status: !bullets.length ? "fail" : qPct >= 50 ? "pass" : qPct >= 25 ? "warn" : "fail",
    detail: bullets.length ? `${quantified} of ${bullets.length} bullets (${qPct}%) contain a number, % or €.` : "No experience bullets found.",
    fix: "Aim for at least half your bullets to carry a number: volume, € saved, % improved, lead time cut, SKUs, suppliers, team size.",
  });

  // 2. Strong action openers
  const weak = bullets.filter((b) => WEAK_OPENERS.some((w) => b.toLowerCase().replace(/^[-•*–\s]+/, "").startsWith(w)));
  add({
    id: "openers", label: "Bullets start with strong action verbs", weight: 2,
    status: !weak.length ? "pass" : weak.length / Math.max(1, bullets.length) <= 0.2 ? "warn" : "fail",
    detail: weak.length ? `${weak.length} bullet${weak.length > 1 ? "s" : ""} open with duty language, e.g. “${weak[0].slice(0, 70)}${weak[0].length > 70 ? "…" : ""}”.` : "No “responsible for / helped / worked on” openers.",
    fix: "Lead with what you did and achieved: Reduced, Negotiated, Implemented, Forecasted, Optimised, Led — not “Responsible for”.",
  });

  // 3. No first-person pronouns
  const pronounLines = [...bullets, p.summary ?? ""].filter((b) => PRONOUN.test(b));
  add({
    id: "pronouns", label: "No “I / my” in bullets and summary", weight: 1,
    status: pronounLines.length ? "warn" : "pass",
    detail: pronounLines.length ? `${pronounLines.length} line${pronounLines.length > 1 ? "s use" : " uses"} first person.` : "Written in the implied first person, as expected.",
    fix: "Drop the pronoun and start with the verb: “I managed 40 suppliers” → “Managed 40 suppliers”.",
  });

  // 4. Bullet length (one to two lines)
  const long = bullets.filter((b) => words(b) > 32);
  const avg = bullets.length ? Math.round(bullets.reduce((s, b) => s + words(b), 0) / bullets.length) : 0;
  add({
    id: "length", label: "Bullets are one to two lines", weight: 1,
    status: !long.length ? "pass" : long.length <= 2 ? "warn" : "fail",
    detail: bullets.length ? `Average ${avg} words; ${long.length} bullet${long.length === 1 ? " is" : "s are"} over 32 words.` : "No bullets to measure.",
    fix: "Keep each bullet to one achievement in 12–25 words. Split long ones or cut the context.",
  });

  // 5. Bullets per role
  const recent = roles.slice(0, 3);
  const thin = recent.filter((r) => (r.bullets ?? []).length < 2);
  const bloated = recent.filter((r) => (r.bullets ?? []).length > 7);
  add({
    id: "perrole", label: "Recent roles have 3–6 bullets", weight: 1,
    status: !roles.length ? "fail" : thin.length || bloated.length ? "warn" : "pass",
    detail: !roles.length
      ? "No work experience parsed."
      : thin.length
        ? `${thin.map((r) => r.title || r.company).join(", ")}: fewer than 2 bullets.`
        : bloated.length
          ? `${bloated.map((r) => r.title || r.company).join(", ")}: more than 7 bullets.`
          : "Recent roles are well covered.",
    fix: "Give your latest role 4–6 bullets and older roles 2–3. Recruiters read the top third most.",
  });

  // 6. Professional summary
  const summaryWords = words(p.summary ?? "");
  add({
    id: "summary", label: "Short profile at the top", weight: 2,
    status: summaryWords >= 20 && summaryWords <= 90 ? "pass" : summaryWords ? "warn" : "fail",
    detail: !summaryWords ? "No profile/summary found." : summaryWords < 20 ? `Summary is only ${summaryWords} words.` : summaryWords > 90 ? `Summary is ${summaryWords} words; it will be skimmed past.` : `${summaryWords}-word profile.`,
    fix: "3 lines: who you are (e.g. “Supply-chain analyst, MSc …”), your strongest proof (a number), and the role you want in Germany.",
  });

  // 7. Languages with CEFR levels
  const langs = p.languages ?? [];
  const unlabelled = langs.filter((l) => !CEFR.test(l.level ?? ""));
  add({
    id: "cefr", label: "Languages with CEFR levels (A1–C2)", weight: 2,
    status: !langs.length ? "fail" : unlabelled.length ? "warn" : "pass",
    detail: !langs.length ? "No languages section found." : unlabelled.length ? `No CEFR level for: ${unlabelled.map((l) => l.language).join(", ")}.` : langs.map((l) => `${l.language} ${l.level}`).join(" · "),
    fix: "German recruiters filter on German level. Write e.g. “German — B2 (Goethe certificate)”, “English — C1”.",
  });

  // 8. Work permit
  add({
    id: "permit", label: "Visible work-permit line", weight: 3,
    status: p.workPermit?.trim() ? "pass" : "fail",
    detail: p.workPermit?.trim() ? p.workPermit : "Nothing says whether you may work in Germany.",
    fix: "Add under contact details: “Work permit: allowed to work full-time in Germany (§16b/§20 AufenthG; EU Blue Card eligible after graduation)”. Recruiters skip non-EU CVs when unsure.",
  });

  // 9. Dates: complete, consistent, reverse-chronological, no unexplained gaps
  const datedRoles = roles.filter((r) => r.start?.trim());
  const shapes = new Set([...roles.flatMap((r) => [r.start, r.end])].filter((d) => d?.trim() && monthIndex(d) !== Infinity).map((d) => dateShape(d)));
  const starts = roles.map((r) => monthIndex(r.start ?? ""));
  const ordered = starts.every((s, i) => i === 0 || s == null || starts[i - 1] == null || (starts[i - 1] as number) >= (s as number));
  const dateIssues: string[] = [];
  if (datedRoles.length < roles.length) dateIssues.push(`${roles.length - datedRoles.length} role(s) without dates`);
  if (shapes.size > 1) dateIssues.push(`mixed formats (${[...shapes].join(", ")})`);
  if (!ordered) dateIssues.push("not newest-first");
  add({
    id: "dates", label: "Dates complete, consistent, newest first", weight: 2,
    status: !roles.length ? "warn" : dateIssues.length ? (dateIssues.length > 1 ? "fail" : "warn") : "pass",
    detail: dateIssues.length ? `${dateIssues.join("; ")}.` : "Dates look consistent.",
    fix: "Use one format everywhere (MM/YYYY is standard in Germany) and list the newest role first.",
  });

  const spans = roles
    .map((r) => ({ s: monthIndex(r.start ?? ""), e: monthIndex(r.end ?? "") }))
    .filter((x): x is { s: number; e: number } => x.s != null && x.e != null)
    .sort((a, b) => a.s - b.s);
  const gaps: number[] = [];
  let reach = spans[0]?.e ?? 0;
  for (const x of spans.slice(1)) {
    if (x.s - reach > 6 && reach !== Infinity) gaps.push(x.s - reach);
    reach = Math.max(reach, x.e);
  }
  add({
    id: "gaps", label: "No unexplained gaps over 6 months", weight: 1,
    status: gaps.length ? "warn" : "pass",
    detail: gaps.length ? `${gaps.length} gap${gaps.length > 1 ? "s" : ""} between roles (longest ${Math.max(...gaps)} months).` : "No long gaps between roles.",
    fix: "Label gaps honestly: “Master’s studies”, “Relocation to Germany & German course (B1→B2)”. German recruiters expect a gap-free Lebenslauf.",
  });

  // 10. Length
  const pages = Math.max(0.5, Math.round((words(text) / 450) * 2) / 2);
  add({
    id: "pages", label: "Two pages or less", weight: 1,
    status: !text ? "warn" : pages <= 2 ? "pass" : pages <= 2.5 ? "warn" : "fail",
    detail: text ? `About ${pages} page${pages === 1 ? "" : "s"} of text.` : "Couldn’t measure length.",
    fix: "Early-career CVs should fit on 1–2 pages. Cut coursework lists and old roles first.",
  });

  // 11. Contact details
  const hasEmail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(text);
  const hasPhone = /(\+?\d[\d\s()/-]{7,}\d)/.test(text);
  const hasLinkedIn = /linkedin\.com\//i.test(text);
  const missing = [!hasEmail && "email", !hasPhone && "phone", !hasLinkedIn && "LinkedIn URL"].filter(Boolean) as string[];
  add({
    id: "contact", label: "Email, phone and LinkedIn", weight: 1,
    status: !missing.length ? "pass" : missing.length === 1 && !hasLinkedIn ? "warn" : "fail",
    detail: missing.length ? `Missing: ${missing.join(", ")}.` : "All contact details present.",
    fix: "Put a German mobile number (+49), a professional email and your LinkedIn URL in the header.",
  });

  // 12. Skills backed by evidence
  const listed = [...(p.skills ?? []), ...(p.tools ?? [])].map((s) => s.trim()).filter((s) => s.length > 1);
  const body = bullets.join(" ").toLowerCase();
  const evidenced = listed.filter((s) => body.includes(s.toLowerCase().split(/[\s(/]/)[0]));
  const ePct = pct(evidenced.length, listed.length);
  add({
    id: "evidence", label: "Listed skills show up in your bullets", weight: 2,
    status: !listed.length ? "warn" : ePct >= 40 ? "pass" : ePct >= 20 ? "warn" : "fail",
    detail: listed.length ? `${evidenced.length} of ${listed.length} skills/tools (${ePct}%) are backed by a bullet.` : "No skills section found.",
    fix: "For your top 5 skills, show where you used them: “Built a demand forecast in Python that cut stock-outs by [X]%”.",
  });

  // 13. Supply-chain tooling (SAP/ERP/analytics) — screening keyword in Germany
  add({
    id: "tools", label: "ERP / analytics tools named (SAP, Excel, Power BI…)", weight: 1,
    status: ERP.test(text) ? "pass" : "warn",
    detail: ERP.test(text) ? "Tool keywords recruiters search for are present." : "No SAP/ERP or analytics tools mentioned.",
    fix: "German supply-chain ads filter on SAP (MM/SD/EWM), Excel and Power BI. Name the ones you’ve used, with the module.",
  });

  // 14. Clichés
  const found = CLICHES.filter((c) => text.toLowerCase().includes(c));
  add({
    id: "cliches", label: "No empty buzzwords", weight: 1,
    status: !found.length ? "pass" : found.length <= 2 ? "warn" : "fail",
    detail: found.length ? `Found: ${found.slice(0, 5).map((c) => `“${c}”`).join(", ")}.` : "No filler adjectives.",
    fix: "Replace adjectives with proof. Instead of “detail-oriented”, show the error rate you cut.",
  });

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + c.weight * (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0);
  return { checks, score: Math.round((got / total) * 100) };
}
