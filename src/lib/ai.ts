// All Claude prompts and their output schemas.
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { llmJson } from "./llm";
import { QUESTION_BANK } from "./questionBank";
import {
  COMPETENCIES,
  type Application,
  type Debrief,
  type Difficulty,
  type GeneralReview,
  type InterviewLanguage,
  type InterviewType,
  type Job,
  type JobParsed,
  type JobReview,
  type Lang,
  type Profile,
  type Resume,
  type ResumeParsed,
  type SessionPlan,
  type Story,
  type Turn,
} from "./types";

const Comp = z.enum(COMPETENCIES);
const LangZ = z.enum(["en", "de"]);
const s15 = z.number().describe("Integer score 1-5");

type Block = Anthropic.Beta.Messages.BetaContentBlockParam;

const ROLE = `You are part of "Mock Interview Buddy", a private coaching tool for an Egyptian master's student in Germany who is applying for supply-chain jobs (planning, procurement, logistics, analyst roles) and has had many interviews without an offer. Your job is to find out honestly why, and help him improve. Be direct and specific; never flatter. Quote his own words as evidence when you criticise.`;

function profileText(p: Profile) {
  const rows = Object.entries(p).filter(([, v]) => v);
  return rows.length ? rows.map(([k, v]) => `${k}: ${v}`).join("\n") : "(profile not filled in)";
}

function resumeBrief(r: Resume | null | undefined) {
  if (!r) return "CV: none uploaded for this session. Learn his background from his answers (and the profile below); do not refer to a CV.";
  return `CV (version ${r.version}):\n${JSON.stringify(r.parsed)}`;
}

function jobBrief(j: Job) {
  if (j.general)
    return j.general.companyId === "any"
      ? `GENERAL INTERVIEW (no specific job ad or company):\n${j.rawText}\n\nYou are an interviewer at a typical mid-to-large company in Germany (invent a plausible company name in its sector and keep it consistent) hiring for an entry-level ${j.parsed.title.replace(" (general)", "")} role.`
      : `GENERAL COMPANY INTERVIEW (there is no specific job ad):\n${j.rawText}\n\nYou are an interviewer at ${j.parsed.company} hiring for an entry-level ${j.parsed.title.replace(" (general)", "")} role in Germany. Stay in character as someone from ${j.parsed.company}: reflect its business, scale and what it values, and ask why ${j.parsed.company} specifically. Use only well-known public facts about the company; never invent internal details, numbers or named people.`;
  return `JOB AD (structured):\n${JSON.stringify(j.parsed)}\n\nJOB AD (raw, truncated):\n${j.rawText.slice(0, 6000)}`;
}

// ---------------- CV & job parsing ----------------

const ResumeParsedZ = z.object({
  name: z.string(),
  headline: z.string(),
  summary: z.string(),
  experience: z.array(
    z.object({ title: z.string(), company: z.string(), location: z.string(), start: z.string(), end: z.string(), bullets: z.array(z.string()) }),
  ),
  education: z.array(z.object({ degree: z.string(), school: z.string(), start: z.string(), end: z.string(), details: z.string() })),
  skills: z.array(z.string()),
  tools: z.array(z.string()),
  languages: z.array(z.object({ language: z.string(), level: z.string() })),
  certifications: z.array(z.string()),
  workPermit: z.string().describe("Visa/work-permit line as written in the CV, or empty string if absent"),
  documentLanguage: z.string(),
});

export async function parseResume(input: { pdfBase64?: string; text?: string }): Promise<{ parsed: ResumeParsed; text: string }> {
  const content: Block[] = [];
  if (input.pdfBase64) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 } });
  }
  content.push({
    type: "text",
    text: `${input.text ? `CV TEXT:\n${input.text}\n\n` : ""}Extract this CV into the schema exactly as written (do not improve or invent anything; use empty strings/arrays when absent). Also return plainText: the full CV as clean plain text, preserving its order.`,
  });
  const out = await llmJson(ResumeParsedZ.extend({ plainText: z.string() }), {
    role: "analysis",
    system: "You extract CVs into structured data faithfully. Never add information that is not in the document.",
    content,
  });
  const { plainText, ...parsed } = out;
  return { parsed, text: input.text || plainText };
}

const JobParsedZ = z.object({
  company: z.string(),
  title: z.string(),
  seniority: z.string().describe("e.g. Werkstudent, Trainee, Junior, Mid, Senior"),
  location: z.string(),
  workModel: z.string(),
  adLanguage: z.string(),
  summary: z.string().describe("2-3 sentence summary of the role"),
  mustHave: z.array(z.string()),
  niceToHave: z.array(z.string()),
  tools: z.array(z.string()),
  germanRequired: z.object({
    stated: z.string().describe("German level stated in the ad (CEFR if possible) or 'not stated'"),
    implied: z.string().describe("CEFR level realistically needed to do this job (A2-C2)"),
    reasoning: z.string(),
  }),
  englishRequired: z.string(),
  competencies: z.array(Comp).describe("The 4-7 competencies this job's interviews will test most"),
  likelyQuestions: z.array(z.string()).describe("8-12 specific questions a real interviewer for THIS ad would ask"),
  hygieneNotes: z.string().describe("Visa, salary range, start date or language points a non-EU candidate must prepare for this ad"),
});

export async function parseJob(input: { text?: string; pdfBase64?: string }): Promise<{ parsed: JobParsed; text: string }> {
  const content: Block[] = [];
  if (input.pdfBase64) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 } });
  content.push({
    type: "text",
    text: `${input.text ? `JOB AD:\n${input.text.slice(0, 30000)}\n\n` : ""}Extract this job ad. For germanRequired.implied, judge realistically: an ad written in German, daily work with German suppliers/colleagues/customers, or phone-heavy coordination usually implies B2-C1 even when not stated. Also return plainText: the job ad as clean plain text (drop navigation/cookie/boilerplate text).`,
  });
  const out = await llmJson(JobParsedZ.extend({ plainText: z.string() }), {
    role: "analysis",
    system: `${ROLE}\nYou are an expert German supply-chain recruiter.`,
    content,
  });
  const { plainText, ...parsed } = out;
  return { parsed, text: plainText || input.text || "" };
}

// ---------------- CV reviews ----------------

const RewriteZ = z.object({ original: z.string(), improved: z.string(), why: z.string() });

/** World-class CV standards every review scores against (shown as a scorecard). */
export const CV_SCORECARD_AREAS = [
  "Impact & quantification",
  "Action verbs & ownership",
  "Targeting & positioning",
  "6-second scan (top third, layout)",
  "ATS readability & keywords",
  "Professional summary",
  "Skills backed by evidence",
  "Education & projects",
  "Language, tone & errors",
  "German CV conventions",
  "Length & formatting",
  "Contact, links & work permit",
] as const;

const GeneralReviewZ = z.object({
  overallScore: z.number().describe("0-100 overall CV quality for the German supply-chain market"),
  sixSecondTest: z.string().describe("What a recruiter takes away from a 6-second scan of the top third: who he is, level, target role. Be blunt."),
  scorecard: z
    .array(
      z.object({
        area: z.string().describe("Exactly one of the listed areas"),
        score: z.number().describe("0-10 against a world-class CV (10 = top 1% of CVs a German supply-chain recruiter sees)"),
        verdict: z.string().describe("One sentence"),
        evidence: z.string().describe("Quote or point to the exact part of his CV this score is based on"),
        fix: z.string().describe("The concrete change that would raise this score, with an example where useful"),
      }),
    )
    .describe("One row per listed area, in the listed order"),
  verdict: z.string().describe("One honest paragraph"),
  positioning: z.string().describe("Is the story clear? What kind of supply-chain professional does this CV say he is, and does that match his targets?"),
  strengths: z.array(z.string()),
  germanConventions: z.array(z.object({ item: z.string(), status: z.enum(["ok", "weak", "missing"]), fix: z.string() })),
  redFlags: z.array(z.object({ issue: z.string(), fix: z.string() })),
  bulletRewrites: z.array(RewriteZ).describe("5-8 rewrites of his weakest bullets: action + scope + number + result. Use [X] placeholders where he must supply a real number; never invent numbers."),
  topActions: z.array(z.string()).describe("The 3-5 highest-impact changes, in order"),
});

export async function generalCvReview(resume: Resume, profile: Profile): Promise<GeneralReview> {
  return llmJson(GeneralReviewZ, {
    role: "analysis",
    system: `${ROLE}\nYou are a senior recruiter for supply-chain roles in Germany who screens hundreds of CVs from international candidates, and you coach candidates to world-class CV standards: every bullet as accomplishment + measure + how ("accomplished X, measured by Y, by doing Z"); a top third that passes a 6-second recruiter scan; clean single-column ATS-parsable layout with the employer's keywords; a tight targeted profile; skills proven in bullets, not just listed; German Lebenslauf norms. Score strictly: most real CVs land at 4-6/10 per area; reserve 9-10 for genuinely exceptional work.`,
    content: `${resumeBrief(resume)}\n\nCANDIDATE PROFILE:\n${profileText(profile)}\n\nSCORECARD AREAS (score every one, in this order):\n${CV_SCORECARD_AREAS.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nReview this CV holistically for the German supply-chain job market. For germanConventions check at least: tabular Lebenslauf layout, length (max 2 pages), CEFR-labelled language levels, a visible work-permit/visa line (critical for non-EU candidates), consistent reverse-chronological dates, contact details, photo/personal data handled per German norms, a profile/summary that matches target roles, quantified achievements, ATS-readable formatting. Red flags: unexplained gaps, vague titles, skills lists without evidence, typos, mixed languages.`,
  });
}

const JobReviewZ = z.object({
  fitScore: z.number().describe("0-100 fit of this CV to this ad"),
  verdict: z.string().describe("Would this CV get a recruiter screen for this ad? Why or why not? One paragraph."),
  wouldGetScreen: z.enum(["likely", "maybe", "unlikely"]),
  requirements: z.array(
    z.object({ requirement: z.string(), evidence: z.string().describe("Quote/paraphrase from CV or 'none'"), status: z.enum(["clear", "weak", "missing"]), fix: z.string() }),
  ),
  keywordCoverage: z.number().describe("0-100: share of the ad's important keywords that appear in the CV"),
  missingKeywords: z.array(z.string()),
  bulletRewrites: z.array(RewriteZ).describe("5-8 bullets rewritten to target this ad; [X] placeholders for numbers he must supply"),
  coverLetterTips: z.array(z.string()),
  interviewRisks: z.array(z.string()).describe("Weak points an interviewer for this ad will probably press on"),
});

export async function jobCvReview(resume: Resume, job: Job, profile: Profile): Promise<JobReview["result"]> {
  return llmJson(JobReviewZ, {
    role: "analysis",
    system: `${ROLE}\nYou are the recruiter screening applications for this exact job ad.`,
    content: `${jobBrief(job)}\n\n${resumeBrief(resume)}\n\nCANDIDATE PROFILE:\n${profileText(profile)}\n\nAssess the CV against every must-have and nice-to-have requirement. Include language requirements (German level) and work-permit questions in the requirements table.`,
  });
}

// ---------------- Interview ----------------

export const PERSONAS: Record<InterviewType, { label: string; who: string; focus: string }> = {
  hr: {
    label: "HR screen",
    who: "an in-house recruiter (Personalreferent/in) at the company",
    focus: "motivation, CV walkthrough, why this company, visa/work-permit status, salary expectation, start date/notice period, German level (switch briefly into German to test it), one or two behavioural questions",
  },
  manager: {
    label: "Hiring manager",
    who: "the supply-chain/logistics manager who would be his boss",
    focus: "behavioural STAR questions, ownership, stakeholder management, real depth in his past work, domain questions tied to the job ad",
  },
  technical: {
    label: "Technical / case",
    who: "a senior planner or analyst from the team",
    focus: "domain knowledge (inventory, forecasting, S&OP, procurement, logistics, KPIs, SAP/Excel) and spoken case questions with numbers; check his reasoning step by step",
  },
  german: {
    label: "German round",
    who: "a German team lead (Teamleiter/in) who only speaks German in this conversation",
    focus: "the same content as a hiring-manager interview, but entirely in German, testing whether his German works for the real job (phone calls with suppliers, meetings, explaining problems)",
  },
  pressure: {
    label: "Pressure round",
    who: "a sceptical senior panel member",
    focus: "deep probing, challenging vague claims, 'that's not what I asked', curveballs, testing composure; interrupt long-winded answers",
  },
};

const DIFFICULTY: Record<Difficulty, string> = {
  friendly: "Warm and encouraging tone, but still a real interview. At most one follow-up per question.",
  realistic: "Neutral, professional German corporate tone. Follow up when an answer is vague (max 2 follow-ups per question).",
  tough: "Demanding and sceptical. Always probe for his own role, numbers and results; challenge weak claims (max 2 follow-ups per question).",
};

const SessionPlanZ = z.object({
  openingLine: z.string().describe("Greeting + short self-introduction + first question, in the first question's language, max 70 words"),
  interviewerName: z.string(),
  interviewerTitle: z.string(),
  questions: z.array(
    z.object({
      no: z.number(),
      text: z.string(),
      competency: Comp,
      lang: LangZ,
      kind: z.enum(["opening", "behavioral", "domain", "case", "motivation", "hygiene", "closing"]),
      retest: z.boolean(),
      probeFocus: z.string().describe("What a good answer must contain / what to press on"),
    }),
  ),
  weakPointsToProbe: z.array(z.string()),
});

export async function planSession(args: {
  job: Job;
  resume: Resume | null;
  profile: Profile;
  review: JobReview | null;
  type: InterviewType;
  language: InterviewLanguage;
  difficulty: Difficulty;
  lengthMin: number;
  askedBefore: string[];
  weakCompetencies: string[];
  stories?: Story[];
}): Promise<SessionPlan> {
  const nMain = Math.max(3, Math.round(args.lengthMin / 2.7));
  const persona = PERSONAS[args.type];
  const langRule =
    args.type === "german" || args.language === "de"
      ? "Every question in German (lang 'de')."
      : args.language === "mixed"
        ? "Start in English; switch to German (lang 'de') for roughly the second half, the way many German companies test language mid-interview."
        : "Every question in English (lang 'en'), except: if the job needs B2+ German and this is an HR screen, include ONE short question in German to test it.";
  return llmJson(SessionPlanZ, {
    role: "analysis",
    system: `${ROLE}\nYou design realistic mock interviews for supply-chain roles in Germany.`,
    content: `${jobBrief(args.job)}

${resumeBrief(args.resume)}

CANDIDATE PROFILE:
${profileText(args.profile)}

${storiesText(args.stories ?? [])}

${args.review ? `CV-vs-JOB REVIEW (gaps to press on):\n${JSON.stringify({ risks: args.review.result.interviewRisks, requirements: args.review.result.requirements.filter((r) => r.status !== "clear") })}` : ""}

INTERVIEW SETUP
- Interviewer: ${persona.who}. Focus: ${persona.focus}.
- Difficulty: ${args.difficulty}. ${DIFFICULTY[args.difficulty]}
- Length: ${args.lengthMin} minutes → plan exactly ${nMain} main questions, then the closing question "Do you have any questions for us?" (kind 'closing', competency 'closing_questions') as the last item.
- Language: ${langRule}

PRACTICE HISTORY ON THIS JOB
- Questions already asked in earlier sessions (avoid repeating these verbatim): ${args.askedBefore.length ? args.askedBefore.slice(-40).join(" | ") : "none"}
- Weak competencies from earlier sessions (re-test these with DIFFERENT wording, mark retest=true): ${args.weakCompetencies.join(", ") || "none yet"}
About 60% new questions and 40% re-tests when history exists.

CORE BANK (use as inspiration; always rephrase and personalise to his CV and this ad):
${QUESTION_BANK.map((q) => `- [${q.competency}/${q.kind}] ${q.en}`).join("\n")}

Rules: ${args.resume ? `ground questions in HIS actual CV ("You wrote that you… walk me through how") and THIS ad.` : `there is no CV: open with "walk me through your background", then build follow-ups on what he says, and ground the rest in THIS role.`} Questions must be what a real ${persona.label.toLowerCase()} interviewer in Germany would ask. Number questions from 1. The opening line must greet him by first name if known, introduce the interviewer (invent a plausible German name and title), and ask question 1.`,
  });
}

const InterviewerTurnZ = z.object({
  say: z.string().describe("Exactly what the interviewer says next, spoken style, max ~60 words"),
  lang: LangZ,
  kind: z.enum(["question", "probe", "transition", "close", "end"]),
  questionNo: z.number().describe("Plan question number this utterance belongs to"),
  competency: Comp,
});

export type InterviewerTurn = z.infer<typeof InterviewerTurnZ>;

function transcriptText(turns: Turn[]) {
  return turns
    .map((t) =>
      t.speaker === "interviewer"
        ? `INTERVIEWER [Q${t.questionNo ?? "?"} ${t.kind ?? ""}]: ${t.text}`
        : `CANDIDATE (${Math.round(t.durationMs / 1000)}s${t.interrupted ? ", interrupted" : ""}): ${t.text || "(no answer / silence)"}`,
    )
    .join("\n");
}

export async function interviewerNext(args: {
  plan: SessionPlan;
  type: InterviewType;
  difficulty: Difficulty;
  language: InterviewLanguage;
  turns: Turn[];
  elapsedMin: number;
  lengthMin: number;
  candidateName: string;
}): Promise<InterviewerTurn> {
  const persona = PERSONAS[args.type];
  const lastQ = [...args.turns].reverse().find((t) => t.speaker === "interviewer");
  const currentNo = lastQ?.questionNo ?? 1;
  const probesOnCurrent = args.turns.filter((t) => t.speaker === "interviewer" && t.questionNo === currentNo && t.kind === "probe").length;
  const remaining = args.lengthMin - args.elapsedMin;
  return llmJson(InterviewerTurnZ, {
    role: "interviewer",
    system: `You are ${args.plan.interviewerName}, ${args.plan.interviewerTitle} — ${persona.who} — running a live job interview with ${args.candidateName || "the candidate"} for a supply-chain role in Germany. Stay fully in character: this is a real interview, not coaching. Never give feedback, scores, tips or praise like "great answer"; at most a short neutral acknowledgement ("Okay." / "Verstehe."). Speak naturally, one question at a time, short sentences suitable for text-to-speech (no lists, no markdown, no stage directions).

Difficulty: ${args.difficulty}. ${DIFFICULTY[args.difficulty]}
Focus: ${persona.focus}

PROBING POLICY — after each answer check: did he directly answer the question? his OWN role ("I", not just "we")? concrete actions? a measurable result? relevance to the job? If something important is missing and fewer than 2 follow-ups were used on this question, ask ONE targeted follow-up (kind 'probe', same questionNo), e.g. "What exactly did you do?", "What was the number?", "What would you do differently?". Otherwise move to the next plan question (kind 'question'). ${args.type === "pressure" ? "If an answer was interrupted or rambling, cut in firmly and redirect." : ""}
If he asks for clarification, clarify briefly without giving the answer away (kind 'transition', same questionNo).
If the answer was empty/silence, gently repeat or rephrase the question once, then move on.
Use each question's language from the plan; if the candidate switches language on a German question, ask him to continue in German.

TIME: ${args.elapsedMin.toFixed(1)} of ${args.lengthMin} min used (${remaining.toFixed(1)} left). If under 2 minutes remain, skip remaining main questions and go to the closing question. After he has asked his own questions (or says he has none), answer them in 1-2 sentences, thank him, explain next steps vaguely as real interviewers do, say goodbye, and use kind 'end'. Never use 'end' before the closing question has been asked and answered.

INTERVIEW PLAN:
${JSON.stringify(args.plan.questions)}
Weak points to press on: ${args.plan.weakPointsToProbe.join("; ")}`,
    content: `TRANSCRIPT SO FAR:\n${transcriptText(args.turns)}\n\nCurrent question: Q${currentNo}; follow-ups used on it: ${probesOnCurrent}. Produce your next utterance.`,
    maxTokens: 4000,
  });
}

// ---------------- Scoring ----------------

const RUBRIC = `RUBRIC (score each 1-5; use the full range; 3 = acceptable but forgettable):
- relevance: 1 does not answer the question · 3 answers but drifts · 5 answers directly and links to the job
- structure: 1 rambling, no arc · 3 some order · 5 clear Situation→Task→Action→Result (or a clear framework for case questions)
- specificity: 1 generic/hypothetical · 3 a real example but no numbers · 5 concrete example with numbers, scale, timeframe
- ownership: 1 only "we"/team · 3 some personal actions · 5 clear personal decisions and actions
- domainDepth: 1 buzzwords or wrong · 3 correct but textbook · 5 practical, correct supply-chain reasoning with trade-offs
- concision: 1 far too long (>3 min) or too short (<20 s) · 3 a bit long/short · 5 right length for the question
- correctness: only for case/calculation/technical questions (1 wrong · 3 partly right · 5 right with sound reasoning); null otherwise.
ANCHOR EXAMPLES (specificity): 1 = "I always try to communicate well with suppliers." 3 = "At my internship I worked with a late supplier and we found a solution." 5 = "At X, our main packaging supplier slipped 2 weeks; I re-planned 14 SKUs, pulled 30% of volume to a second supplier and kept OTIF at 96%."
Score what he SAID, not what his CV says. Scores must be consistent: the same answer must always get the same scores.`;

const AnswerScoreZ = z.object({
  answerSummary: z.string(),
  relevance: s15,
  structure: s15,
  specificity: s15,
  ownership: s15,
  domainDepth: s15,
  concision: s15,
  correctness: z.number().nullable().describe("1-5 for case/technical questions, else null"),
  costlyQuote: z.string().describe("The exact phrase from his answer that cost the most points ('' if none)"),
  whatWasMissing: z.string(),
  modelAnswer: z.string().describe("A strong answer built ONLY from his real CV experience (use [X] for numbers he must fill in), in the question's language, 90-160 words"),
});

export async function scoreAnswer(args: {
  questionNo: number;
  question: string;
  competency: string;
  kind: string;
  thread: Turn[];
  job?: Job;
  resume: Resume | null;
  stories?: Story[];
}) {
  return llmJson(AnswerScoreZ, {
    role: "analysis",
    system: `${ROLE}\nYou are a calibrated interview assessor for supply-chain roles in Germany.\n\n${RUBRIC}`,
    content: `ROLE: ${args.job ? `${args.job.parsed.title} at ${args.job.parsed.company}. Must-haves: ${args.job.parsed.mustHave.join("; ")}` : "General supply-chain role in Germany (planning/procurement/logistics)"}
${resumeBrief(args.resume)}
${storiesText(args.stories ?? [])}

QUESTION ${args.questionNo} (${args.kind}, competency ${args.competency}): ${args.question}

EXCHANGE (main question, his answers and any follow-ups):
${transcriptText(args.thread)}

Score his answers to this question as a whole.`,
  });
}

const LanguageZ = z.object({
  cefr: z.string().describe("Estimated CEFR level from this interview, e.g. B1, B2"),
  fluency: s15,
  grammar: s15,
  vocabulary: s15,
  domainVocabulary: s15,
  comprehension: s15.describe("Did he understand questions first time?"),
  notes: z.string(),
  phrasesToPractice: z.array(z.object({ phrase: z.string(), meaning: z.string() })).describe("6-10 useful job phrases he lacked"),
  corrections: z.array(z.object({ said: z.string(), better: z.string() })).describe("Up to 8 real errors from the transcript with corrections"),
});

export async function assessLanguage(args: { lang: Lang; turns: Turn[]; required: string; repeatRequests: number }) {
  const name = args.lang === "de" ? "German" : "English";
  return llmJson(LanguageZ, {
    role: "analysis",
    system: `You are a certified ${name} examiner (CEFR, e.g. Goethe/telc for German) who also knows the language of supply-chain work.`,
    content: `Assess the candidate's spoken ${name} in this job interview. Transcripts come from speech recognition, so ignore punctuation and minor transcription noise; focus on grammar, vocabulary range, fluency and whether he could express professional ideas. Level the job needs: ${args.required || "unknown"}. He asked for questions to be repeated ${args.repeatRequests} time(s).\n\nTRANSCRIPT (${name} parts):\n${transcriptText(args.turns)}`,
  });
}

const ReportZ = z.object({
  verdict: z.enum(["strong_no", "no", "lean_yes", "yes"]).describe("What a real hiring committee for this role would decide based on this interview"),
  verdictReason: z.string(),
  summary: z.string().describe("3-5 sentences: what went well, what would get him rejected"),
  strengths: z.array(z.string()).describe("Exactly 2 genuine strengths with evidence"),
  drills: z.array(z.object({ skill: Comp, title: z.string(), detail: z.string() })).describe("Exactly 3 specific, practisable drills, highest impact first"),
  silentRejecters: z.array(z.string()).describe("Weak answers on visa/salary/start date/German level/motivation that can silently cause rejection ([] if none)"),
  comparison: z.string().describe("Compared with the previous session on this job (if given): what improved and what got worse. '' if no previous session."),
});

export async function writeReport(evidence: unknown) {
  return llmJson(ReportZ, {
    role: "verdict",
    system: `${ROLE}\nYou chair the hiring committee and also coach the candidate afterwards. Base everything on the evidence; cite numbers and quotes.`,
    content: `EVIDENCE FROM THIS MOCK INTERVIEW:\n${JSON.stringify(evidence)}\n\nWrite the verdict and coaching report.`,
  });
}

// ---------------- Diagnosis ----------------

const DiagnosisZ = z.object({
  dataSufficiency: z.string().describe("How much evidence there is and how much to trust this diagnosis"),
  headline: z.string().describe("One sentence: the most likely reason he is not getting hired"),
  causes: z.array(
    z.object({
      rank: z.number(),
      area: z.enum(["cv", "content", "delivery", "presence", "german", "hygiene", "targeting", "other"]),
      title: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
      evidence: z.array(z.string()).describe("Concrete numbers/quotes from the evidence pack"),
      whatToDo: z.array(z.string()),
    }),
  ),
  notTheProblem: z.array(z.string()).describe("Areas the evidence suggests are NOT the bottleneck"),
  nextSteps: z.array(z.string()).describe("The next 3-5 actions, in order"),
});

export async function diagnose(evidence: unknown) {
  return llmJson(DiagnosisZ, {
    role: "verdict",
    system: `${ROLE}\nYou are a career diagnostician. Combine real application outcomes (the funnel) with CV reviews and mock-interview scores to rank the root causes of rejection. Use confidence levels honestly: high confidence needs at least 5 logged applications AND 3 scored sessions agreeing. Typical benchmarks: application→screen 10-30% is normal for international candidates; screen→offer below 10% across 10+ interviews points to the interview itself.`,
    content: `EVIDENCE PACK:\n${JSON.stringify(evidence)}\n\nRank the causes (1-4 items).`,
  });
}

// ---------------- Feedback email ----------------

export async function feedbackEmail(app: Application, lang: Lang, candidateName: string) {
  return llmJson(z.object({ subject: z.string(), body: z.string() }), {
    role: "analysis",
    system: "You write short, polite, professional emails for job seekers in Germany.",
    content: `Write a ${lang === "de" ? "German (formal Sie)" : "English"} email from ${candidateName || "the candidate"} to the recruiter at ${app.company} about the ${app.role} application (reached stage: ${app.stage}, outcome: ${app.outcome}). Thank them and ask for 2-3 sentences of honest feedback on what he could improve (CV, interview, German level). Under 120 words, no grovelling.`,
  });
}

// ---------------- Story bank ----------------

export function storiesText(stories: Story[]) {
  if (!stories.length) return "";
  return `HIS STORY BANK (real STAR stories he has prepared; model answers and prep should reuse these):\n${stories
    .map((s) => `- [${s.competencies.join(", ")}] ${s.title}: S: ${s.situation} T: ${s.task} A: ${s.action} R: ${s.result} ${s.metrics}`)
    .join("\n")}`;
}

const StoriesZ = z.object({
  stories: z.array(
    z.object({
      title: z.string().describe("Short memorable name, e.g. 'Supplier delay at X'"),
      situation: z.string(),
      task: z.string(),
      action: z.string().describe("HIS personal actions, first person, concrete steps"),
      result: z.string().describe("Outcome; use [X] placeholders where he must supply a real number"),
      metrics: z.string().describe("Numbers he should confirm or find, e.g. '[X]% OTIF, [X] SKUs'"),
      competencies: z.array(Comp).describe("1-3 competencies this story proves"),
      answersQuestions: z.array(z.string()).describe("3-4 interview questions this story answers"),
    }),
  ),
});

export async function mineStories(resume: Resume, profile: Profile, existing: Story[]) {
  const out = await llmJson(StoriesZ, {
    role: "analysis",
    system: `${ROLE}\nYou are an interview coach who turns CV lines into reusable STAR stories. Never invent events: build each story only from what the CV states, and mark anything he must fill in with [X] or [describe ...].`,
    content: `${resumeBrief(resume)}\n\nCANDIDATE PROFILE:\n${profileText(profile)}\n\n${existing.length ? `STORIES HE ALREADY HAS (do not duplicate):\n${existing.map((s) => `- ${s.title}`).join("\n")}\n\n` : ""}Draft 6-10 STAR stories covering as many of these competencies as his CV allows: stakeholder management, problem solving, data & analysis, supply-chain planning, procurement/suppliers, logistics/operations, ERP/tools, ownership, communication, motivation. Prefer stories with numbers and personal decisions.`,
  });
  return out.stories;
}

// ---------------- Prep pack ----------------

const PrepZ = z.object({
  pitchEn: z.string().describe("60-second 'tell me about yourself' in English, tailored to this ad, first person"),
  pitchDe: z.string().describe("The same pitch in natural spoken German (Sie-context), at B1-B2 level so he can actually say it"),
  whyThisCompany: z.string().describe("A specific, honest answer to 'why us / why this role' using the ad"),
  topQuestions: z.array(
    z.object({ q: z.string(), why: z.string().describe("Why they will ask it"), story: z.string().describe("Which of his stories to use (title) or what to say"), keyPoints: z.array(z.string()) }),
  ).describe("The 8 most likely questions for this ad"),
  salaryScript: z.string().describe("What to say when asked about salary: a researched range for this role/city/seniority in Germany (gross per year) and how to phrase it"),
  visaScript: z.string().describe("A confident 2-3 sentence answer about work permit/visa (e.g. §20 job-seeker after studies, EU Blue Card eligibility); based on his profile; no legal advice beyond the basics"),
  germanAnswerScript: z.string().describe("How to answer 'How good is your German?' honestly and positively, with a sentence in German"),
  questionsToAsk: z.array(z.string()).describe("4-5 smart questions for the interviewer"),
  germanPhrases: z.array(z.object({ de: z.string(), en: z.string() })).describe("10-14 German phrases specific to this job's daily work and interview"),
  avoid: z.array(z.string()).describe("3-5 things NOT to say for this role (based on his past mistakes if given)"),
  checklist: z.array(z.string()).describe("Day-before checklist, 5-8 items"),
});

export async function buildPrepPack(args: { job: Job; resume: Resume; profile: Profile; stories: Story[]; review: JobReview | null; weakPoints: string[] }) {
  return llmJson(PrepZ, {
    role: "analysis",
    system: `${ROLE}\nYou prepare a candidate for a specific real interview in Germany. Everything must be usable as-is: short, spoken, specific to this company and his real background. Never invent experience; use [X] placeholders.`,
    content: `${jobBrief(args.job)}\n\n${resumeBrief(args.resume)}\n\nCANDIDATE PROFILE:\n${profileText(args.profile)}\n\n${storiesText(args.stories)}\n\n${args.review ? `CV-vs-JOB REVIEW RISKS:\n${args.review.result.interviewRisks.join("\n")}` : ""}\n\nWEAK POINTS FROM HIS MOCK INTERVIEWS:\n${args.weakPoints.join("\n") || "none recorded yet"}\n\nBuild the prep pack.`,
  });
}

// ---------------- Real-interview debrief ----------------

const DebriefZ = z.object({
  summary: z.string().describe("Honest 3-4 sentence read of how the real interview probably went"),
  likelyVerdict: z.enum(["strong_no", "no", "lean_yes", "yes"]),
  perQuestion: z.array(z.object({ q: z.string(), score: s15, assessment: z.string(), betterAnswer: z.string().describe("A stronger answer from his real background, 60-120 words, in the question's language") })),
  redFlags: z.array(z.string()).describe("Things he said or did that commonly cause rejection"),
  whatToPractise: z.array(z.string()).describe("3 concrete things to practise before the next real interview"),
});

export async function assessDebrief(args: { debrief: Omit<Debrief, "id" | "createdAt" | "result">; app: Application | undefined; job: Job | undefined; resume: Resume | undefined; stories: Story[] }) {
  const d = args.debrief;
  return llmJson(DebriefZ, {
    role: "verdict",
    system: `${ROLE}\nHe just had a REAL interview and wrote down, from memory, what was asked and what he answered. Assess it like the interviewer would have. His notes are a paraphrase, so judge content and approach, not wording. Be kind but honest.`,
    content: `${args.job ? jobBrief(args.job) : `ROLE: ${args.app?.role ?? "?"} at ${args.app?.company ?? "?"}`}\n\n${args.resume ? resumeBrief(args.resume) : ""}\n\n${storiesText(args.stories)}\n\nINTERVIEW: stage ${d.stage}, language ${d.language}, interviewers: ${d.interviewers || "?"}; his feeling ${d.feeling}/5.\nHIS NOTES: ${d.notes || "-"}\n\nQUESTIONS AND HIS ANSWERS:\n${d.questions.map((q, i) => `${i + 1}. Q: ${q.q}\n   His answer: ${q.myAnswer || "(not noted)"}`).join("\n")}`,
  });
}
