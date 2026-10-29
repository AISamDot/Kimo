// Shared domain types for Mock Interview Buddy.

export type Lang = "en" | "de";
export type InterviewLanguage = "en" | "de" | "mixed";
export type InterviewType = "hr" | "manager" | "technical" | "german" | "pressure";
export type Difficulty = "friendly" | "realistic" | "tough";

export const COMPETENCIES = [
  "motivation_fit",
  "cv_walkthrough",
  "communication",
  "stakeholder_management",
  "problem_solving",
  "analytical_data",
  "supply_chain_planning",
  "procurement_supplier",
  "logistics_operations",
  "erp_tools",
  "leadership_ownership",
  "german_language",
  "hygiene",
  "closing_questions",
] as const;
export type Competency = (typeof COMPETENCIES)[number];

export const COMPETENCY_LABELS: Record<Competency, string> = {
  motivation_fit: "Motivation & fit",
  cv_walkthrough: "CV walkthrough",
  communication: "Communication",
  stakeholder_management: "Stakeholder management",
  problem_solving: "Problem solving",
  analytical_data: "Data & analysis",
  supply_chain_planning: "Planning, S&OP & inventory",
  procurement_supplier: "Procurement & suppliers",
  logistics_operations: "Logistics & operations",
  erp_tools: "ERP/SAP & tools",
  leadership_ownership: "Ownership & leadership",
  german_language: "German in the job",
  hygiene: "Visa, salary, start date",
  closing_questions: "Your questions",
};

export interface ApiKeys {
  anthropic: string;
  elevenlabs: string;
  openai: string;
  deepgram: string;
  hume: string;
  azureSpeech: string;
  azureRegion: string;
  tavus: string;
}

export type SttProvider = "openai" | "elevenlabs" | "deepgram" | "browser";
export type TtsProvider = "elevenlabs" | "openai" | "browser";
export type AvatarMode = "none" | "animated" | "tavus";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface Settings {
  keys: ApiKeys;
  models: { interviewer: string; analysis: string; verdict: string };
  effort: { interviewer: Effort; analysis: Effort; verdict: Effort };
  stt: SttProvider;
  tts: TtsProvider;
  avatar: AvatarMode;
  voices: {
    elevenlabsVoiceId: string;
    elevenlabsModel: string;
    elevenlabsSttModel: string;
    openaiVoice: string;
    openaiTtsModel: string;
    openaiSttModel: string;
    deepgramModel: string;
  };
  tavus: { replicaId: string; palId: string };
  features: { webcam: boolean; hume: boolean; azurePronunciation: boolean };
  interview: { silenceMs: number; pressureMaxAnswerSec: number };
  weights: { content: number; delivery: number; language: number; presence: number };
  readiness: { threshold: number; floor: number };
  data: { audioRetentionDays: number; deleteAudioAfterAnalysis: boolean };
}

export interface Profile {
  name: string;
  germanLevel: string; // e.g. "B2"
  germanCertificate: string;
  visaStatus: string;
  earliestStart: string;
  salaryExpectation: string;
  targetCities: string;
  targetRoles: string;
  notes: string;
}

export interface ResumeParsed {
  name: string;
  headline: string;
  summary: string;
  experience: { title: string; company: string; location: string; start: string; end: string; bullets: string[] }[];
  education: { degree: string; school: string; start: string; end: string; details: string }[];
  skills: string[];
  tools: string[];
  languages: { language: string; level: string }[];
  certifications: string[];
  workPermit: string;
  documentLanguage: string;
}

export interface Resume {
  id: string;
  version: number;
  label: string;
  fileName: string;
  createdAt: string;
  text: string;
  parsed: ResumeParsed;
  generalReview?: GeneralReview;
  generalReviewAt?: string;
}

export interface JobParsed {
  company: string;
  title: string;
  seniority: string;
  location: string;
  workModel: string;
  adLanguage: string;
  summary: string;
  mustHave: string[];
  niceToHave: string[];
  tools: string[];
  germanRequired: { stated: string; implied: string; reasoning: string };
  englishRequired: string;
  competencies: Competency[];
  likelyQuestions: string[];
  hygieneNotes: string;
}

export interface Job {
  id: string;
  createdAt: string;
  source: "text" | "file" | "url";
  url: string;
  rawText: string;
  parsed: JobParsed;
}

export interface GeneralReview {
  overallScore: number;
  verdict: string;
  positioning: string;
  strengths: string[];
  germanConventions: { item: string; status: "ok" | "weak" | "missing"; fix: string }[];
  redFlags: { issue: string; fix: string }[];
  bulletRewrites: { original: string; improved: string; why: string }[];
  topActions: string[];
}

export interface JobReview {
  id: string;
  jobId: string;
  resumeId: string;
  createdAt: string;
  result: {
    fitScore: number;
    verdict: string;
    wouldGetScreen: "likely" | "maybe" | "unlikely";
    requirements: { requirement: string; evidence: string; status: "clear" | "weak" | "missing"; fix: string }[];
    keywordCoverage: number;
    missingKeywords: string[];
    bulletRewrites: { original: string; improved: string; why: string }[];
    coverLetterTips: string[];
    interviewRisks: string[];
  };
}

export interface PlanQuestion {
  no: number;
  text: string;
  competency: Competency;
  lang: Lang;
  kind: "opening" | "behavioral" | "domain" | "case" | "motivation" | "hygiene" | "closing";
  retest: boolean;
  probeFocus: string;
}

export interface SessionPlan {
  openingLine: string;
  interviewerName: string;
  interviewerTitle: string;
  questions: PlanQuestion[];
  weakPointsToProbe: string[];
}

export interface AcousticSummary {
  durationSec: number;
  speechSec: number;
  longPauses: number;
  longestPauseSec: number;
  meanDb: number;
  dbSd: number;
  pitchMedianHz: number;
  pitchSdSemitones: number;
  endDropDb: number; // energy of last 30% minus first 30% (negative = trailing off)
  voicedRatio: number;
}

export interface PresenceSample {
  frames: number;
  facePresentPct: number;
  gazeAtCameraPct: number;
  smilePct: number;
  headMotion: number; // mean normalized frame-to-frame movement
  brightness: number; // 0..255
  centeredPct: number;
}

export interface Word {
  w: string;
  s: number;
  e: number;
}

export interface Turn {
  idx: number;
  speaker: "interviewer" | "candidate";
  text: string;
  lang: Lang;
  atMs: number;
  durationMs: number;
  kind?: "question" | "probe" | "transition" | "close" | "end";
  questionNo?: number;
  competency?: Competency;
  audioFile?: string;
  words?: Word[];
  acoustic?: AcousticSummary;
  presence?: PresenceSample;
  repeats?: number;
  interrupted?: boolean;
}

export interface AnswerScore {
  questionNo: number;
  question: string;
  competency: Competency;
  answerSummary: string;
  relevance: number;
  structure: number;
  specificity: number;
  ownership: number;
  domainDepth: number;
  concision: number;
  correctness: number | null;
  costlyQuote: string;
  whatWasMissing: string;
  modelAnswer: string;
}

export interface DeliveryMetrics {
  wpm: number;
  fillersPerMin: number;
  fillerCounts: Record<string, number>;
  longPausesPerAnswer: number;
  avgAnswerSec: number;
  answerLengthOkPct: number;
  talkRatio: number;
  pitchVariation: number;
  trailingOffPct: number;
  score: number;
  subScores: Record<string, number>;
}

export interface LanguageAssessment {
  lang: Lang;
  cefr: string;
  fluency: number;
  grammar: number;
  vocabulary: number;
  domainVocabulary: number;
  comprehension: number;
  pronunciation: number | null;
  requiredLevel: string;
  gap: "meets" | "one_level" | "two_plus" | "unknown";
  notes: string;
  phrasesToPractice: { phrase: string; meaning: string }[];
  corrections: { said: string; better: string }[];
  score: number;
}

export interface VocalImpression {
  topExpressions: { name: string; score: number }[];
  perAnswer: { questionNo: number; top: string[] }[];
  note: string;
}

export interface Report {
  verdict: "strong_no" | "no" | "lean_yes" | "yes";
  verdictReason: string;
  summary: string;
  strengths: string[];
  drills: { skill: Competency; title: string; detail: string }[];
  silentRejecters: string[];
  comparison: string;
}

export interface SessionAnalysis {
  answers: AnswerScore[];
  delivery: DeliveryMetrics;
  language: LanguageAssessment | null;
  presence: (PresenceSample & { score: number; notes: string[] }) | null;
  vocal: VocalImpression | null;
  pronunciation: { accuracy: number; fluency: number; prosody: number | null; overall: number } | null;
  report: Report;
  areaScores: { content: number; delivery: number; language: number | null; presence: number | null };
  overall: number;
  competencyScores: Partial<Record<Competency, number>>;
  costNotes: string[];
}

export type SessionStatus = "live" | "analyzing" | "done" | "failed";

export interface SessionSummary {
  id: string;
  jobId: string;
  resumeId: string;
  type: InterviewType;
  language: InterviewLanguage;
  difficulty: Difficulty;
  lengthMin: number;
  createdAt: string;
  endedAt?: string;
  status: SessionStatus;
  error?: string;
  overall?: number;
  verdict?: Report["verdict"];
  areaScores?: SessionAnalysis["areaScores"];
  competencyScores?: SessionAnalysis["competencyScores"];
  rubricVersion: string;
}

export interface SessionDetail extends SessionSummary {
  plan: SessionPlan;
  turns: Turn[];
  analysis?: SessionAnalysis;
  presenceOverall?: PresenceSample;
  repeatRequests: number;
}

export const STAGES = ["applied", "screen", "interview1", "interview2", "final", "offer"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  applied: "Applied",
  screen: "Recruiter screen",
  interview1: "Interview 1",
  interview2: "Interview 2 / case",
  final: "Final round",
  offer: "Offer",
};

export interface Application {
  id: string;
  company: string;
  role: string;
  date: string;
  resumeId: string;
  jobId: string;
  stage: Stage;
  outcome: "active" | "rejected" | "offer" | "withdrawn" | "ghosted";
  interviewLanguage: "" | "en" | "de" | "mixed";
  roleType: string;
  companySize: "" | "startup" | "mid" | "large";
  feedback: string;
  notes: string;
}

export interface Drill {
  id: string;
  sessionId: string;
  jobId: string;
  skill: Competency;
  title: string;
  detail: string;
  status: "open" | "passed";
  createdAt: string;
  passedAt?: string;
}

export interface DiagnosisCause {
  rank: number;
  area: "cv" | "content" | "delivery" | "presence" | "german" | "hygiene" | "targeting" | "other";
  title: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  whatToDo: string[];
}

export interface Diagnosis {
  id: string;
  createdAt: string;
  dataSufficiency: string;
  headline: string;
  causes: DiagnosisCause[];
  notTheProblem: string[];
  nextSteps: string[];
}

export interface UserDb {
  profile: Profile;
  resumes: Resume[];
  jobs: Job[];
  jobReviews: JobReview[];
  sessions: SessionSummary[];
  applications: Application[];
  drills: Drill[];
  diagnoses: Diagnosis[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  passwordHash: string; // scrypt, "salt:hash" hex
  createdAt: string;
}

export interface AuthSession {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AppConfig {
  settings: Settings;
  allowSignups: boolean;
  users: User[];
  authSessions: AuthSession[];
}
