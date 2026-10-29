# Mock Interview Buddy: Product Requirements Document

**Version:** 0.1 (draft)
**Date:** 23 Oct 2026
**Owner:** Hossam
**User:** Hossam's brother. He is an Egyptian master's student in Germany looking for a supply-chain job.
**Status:** Draft for review. Defaults chosen for the open questions are listed in §14.

---

## 1. Problem

He has applied to dozens of supply-chain jobs in Germany and had dozens of interviews, but no offers. Nobody knows *why*. The possible causes:

1. **CV:** weak fit to the role, weak bullet points, or German CV conventions not followed
2. **Interview content:** vague answers, no numbers, weak structure, not enough supply-chain depth
3. **Delivery:** pace, filler words, hesitation, low energy, rambling
4. **Self-confidence and presence:** eye contact, posture, composure under pressure
5. **German level:** lower than the role really needs, whatever the ad says
6. **Things outside the interview:** visa or work-permit questions, salary expectations, notice period, or targeting the wrong roles or seniority

Today he gets no useful feedback. Rejection emails are generic, and friends are too polite.

**Key insight:** getting dozens of interviews means his CV is passing screening. The drop-off most likely happens *inside* the interview. The product has to test that hypothesis against real data, not assume it.

## 2. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | **Diagnose** why he isn't getting hired | Within 7 days of first use, the Diagnosis page names the top 1–3 causes with evidence |
| G2 | **Fix the CV** for each target role | CV fit score per job ad, with a gap list and rewritten bullets |
| G3 | **Practise realistic interviews** without limits | Live two-way voice interview in English or German. It is personalised to his CV and the job ad, and it pushes back on weak answers |
| G4 | **Measure improvement** objectively | Consistent scoring and a trend tracker per job ad and per skill |
| G5 | **Change the real outcome** | Better conversion from interview to next round to offer in his real application log |

## 3. Non-goals for v1

- A multi-user product, sign-up, payments or a marketing site. It is a private single-user app.
- Applying to jobs automatically or scraping job boards
- Live hints *during* the interview. All feedback comes after the session (a "coach mode" could come later).
- Emotion labels such as "you looked nervous" or "you seemed anxious". We report **observable behaviour** only (see §7.4).
- Replacing human feedback. We recommend at least one mock with a real German supply-chain hiring manager to check the app's scoring (§10).

## 4. User and core loop

**Single user:** the candidate. Hossam may also view the reports.

```
Add CV ──► Add job ad ──► CV review (for this job + general)
                │
                ▼
     Pick interview type and language ──► Live interview (voice, later video)
                                             │
                                             ▼
                               Session report: scores, evidence, 3 drills
                                             │
                                             ▼
                      Tracker: trends per job ad and skill ──► practise again
                                             │
                                             ▼
         Real application log (funnel) ──► Diagnosis page (root-cause verdict)
```

## 5. Features and requirements

### 5.1 Profile and CV

- **F1.1:** Upload a CV as PDF or DOCX, or paste the text. Store each upload as a **version** (CV v1, v2…) so later scores can be tied to a version.
- **F1.2:** Turn the CV into structured data: roles, dates, achievements, skills, tools (SAP, Excel, Power BI…), languages and their CEFR levels, education, and visa or work-permit status.
- **F1.3:** Profile fields not usually in a CV: current German level (self-rated plus any certificate), visa status (student permit, the 18-month job-seeker permit after graduation, Blue Card eligibility), earliest start date, salary expectation, target cities.

### 5.2 Job ads

- **F2.1:** Add a job ad by pasting text, uploading a PDF, or giving a URL that the app fetches.
- **F2.2:** Extract: company, title, seniority, must-have and nice-to-have requirements, tools, **required German level** (stated *and* implied, e.g. an ad written entirely in German, customer-facing work, or work with German suppliers), English level, and location or remote setup.
- **F2.3:** Generate a **likely interview plan** for this ad: the competencies being tested, the likely question areas, and the German-specific hygiene questions (see §6.3).
- **F2.4:** Each job ad is a **practice track** with unlimited sessions.

### 5.3 CV review

The review runs once per CV version and job ad, and once more for the CV in general.

**For a specific job ad:**
- **F3.1:** Requirements match table with columns Requirement → evidence in CV → status (✅ clear / ⚠️ weak / ❌ missing) → suggested fix
- **F3.2:** Keyword coverage for applicant-tracking systems (ATS): the percentage of key terms from the ad that appear in the CV, plus the missing terms
- **F3.3:** Rewrites of the 5–8 most relevant bullets using a measurable formula (action + scope + number + result)
- **F3.4:** A fit score from 0 to 100 with a one-paragraph verdict: "Would this CV get a recruiter screen? Why or why not?"

**General review:**
- **F3.5:** Positioning: is the story clear (what kind of supply-chain professional he is)? Does the summary match the roles he applies for?
- **F3.6:** German-market conventions: a clear Lebenslauf layout, at most 2 pages, CEFR-labelled language levels, a visible work-permit line (this matters a lot for non-EU candidates), consistent dates, and photo and personal data handled the German way
- **F3.7:** Red flags: unexplained gaps, job-hopping, vague job titles, a skills list with no evidence, typos and mixed languages
- **F3.8:** Cover letter (Anschreiben) check. Optional, and pasted per job ad.

**Output:** a review page plus a downloadable Markdown/PDF report. The app does **not** silently rewrite the whole CV. It suggests changes and he decides.

### 5.4 Live mock interview (core feature)

**Session setup**
- **F4.1:** Pick the job ad, the interview **type**, the **language** (English / German / mixed: starting in English and switching to German partway, as many German companies do), the **length** (10 / 20 / 30 min), and the **difficulty** (friendly / realistic / tough).
- **F4.2:** Interview types (interviewer personas):
  | Type | Who it simulates | Focus |
  |---|---|---|
  | HR screen | In-house recruiter | Motivation, CV walkthrough, visa status, salary, notice period, German level |
  | Hiring manager | Supply-chain or logistics manager | Behavioural (STAR), ownership, stakeholder management, domain depth |
  | Technical / case | Senior planner or analyst | Calculations and scenarios: safety stock, EOQ, forecast error, supplier delay, S&OP trade-offs, KPI trees |
  | German round | German-speaking team lead | The same content conducted fully in German, testing real working proficiency |
  | Pressure round | Sceptical panel member | Interruptions, "that's not what I asked", deep probing, curveballs |

**Interviewer behaviour**
- **F4.3:** The interviewer is **grounded** in the CV and job ad. It asks about *his* real experience ("You wrote that you cut lead time by 15% at X. Walk me through how.").
- **F4.4:** **Probing policy.** After each answer the interviewer checks for: a direct answer to the question, *his* own role (not "we"), concrete actions, a measurable result, and relevance to the job. If something is missing, it asks up to **2 follow-ups** ("What exactly did *you* do?", "What was the number?", "What would you do differently?"). Then it moves on.
- **F4.5:** It **pushes on weak points** found in the CV review, such as gaps, missing must-haves, or a weak German level ("This role works daily with German suppliers. How would you handle a difficult phone call in German?").
- **F4.6:** It sounds realistic: natural turn-taking, short acknowledgements, no coaching during the interview, and it stays in character. It closes with "Do you have any questions for us?" and his questions are scored too.
- **F4.7:** He can pause, repeat a question, or end early. Ending early still produces a partial report.
- **F4.8:** **Question variety across repeats:** the interviewer tracks which questions he has already been asked on this job track. About 60% of each session is new questions, about 40% are re-tests of competencies he scored low on, asked with *different wording* so he can't just memorise answers.

**Capture**
- **F4.9:** Record a full transcript of both sides with timestamps.
- **F4.10:** Record **his** microphone audio in the browser, stored for delivery analysis. Whether audio is kept after analysis is configurable.
- **F4.11:** Webcam (Phase 3): analysed **in the browser only**. The video is never uploaded; only the computed numbers are sent (§7.4).

### 5.5 Session report

Ready within about 2 minutes of the session ending.

- **F5.1:** **Headline:** an overall score from 0 to 100, plus a **hiring verdict** the way a real interviewer would give it: Strong no / No / Leaning yes / Yes. It comes with a one-paragraph explanation of *why*.
- **F5.2:** **Area scores** (§7): Content, Delivery, Language (German or English), Presence (Phase 3 onward).
- **F5.3:** **Per-question breakdown:** the question, a short summary of his answer, the score on each rubric dimension, the exact quote that cost points, and a **model answer** built from *his own* real experience.
- **F5.4:** **Top 3 drills:** specific, practisable actions ("Add a number to every result. You gave 1 number in 7 answers.", "Cut the CV walkthrough from 4 minutes to 90 seconds.", "Practise the German phrases for describing problems with suppliers.").
- **F5.5:** **Delivery charts:** words per minute over time, filler words per minute, long pauses, talk-time ratio, answer length against target.
- **F5.6:** **Comparison** with his previous session on the same job track: what improved and what got worse.
- **F5.7:** Export the report as PDF or Markdown so he can share it with Hossam or a mentor.

### 5.6 Progress tracker

- **F6.1:** Line charts of the overall and area scores over time, **per job track** and across all tracks.
- **F6.2:** A **skill heatmap**: competencies (motivation, CV walkthrough, stakeholder management, problem solving, data/Excel/SAP, German fluency, closing questions…) × sessions, coloured by score.
- **F6.3:** **Streaks and volume:** sessions per week and total practice minutes.
- **F6.4:** **Drill checklist:** open drills from reports. A drill is marked "passed" automatically once that skill scores 4/5 or higher in two sessions in a row.
- **F6.5:** **Readiness indicator** per job track: "Interview-ready" when the last 3 sessions average 75 or more with no area below 60. These thresholds are configurable.

### 5.7 Real application log and Diagnosis (the "why")

- **F7.1:** Log every real application with: company, role, date, the CV version used, link to the job track (optional), the **furthest stage reached** (Applied → Recruiter screen → Interview 1 → Interview 2 / case → Final → Offer / Rejected), the rejection reason or feedback if any, and the language the interview was held in.
- **F7.2:** **Funnel view:** conversion at each stage, split by interview language, role type, company size and CV version.
- **F7.3:** **Rejection-feedback helper:** generates a short, polite German or English email asking the recruiter for feedback. He sends it himself.
- **F7.4:** **Diagnosis page.** Combines the funnel data, the CV review results and the mock scores into a ranked root-cause verdict, for example:
  > **#1 Interview content (high confidence):** 9 of 11 real interviews ended after round 1. In mocks, Specificity averages 2.1/5: answers lack numbers and his own role.
  > **#2 German level for the target roles (medium confidence):** 70% of target ads imply B2+ German. German-round mocks estimate B1. Every rejection where the interview was in German came after round 1.
  > **#3 CV positioning (low confidence):** a 38% application-to-screen rate is in the normal range, so the CV is not the main bottleneck.
- **F7.5:** The Diagnosis is updated after every session and every log entry, and it states its confidence and the evidence behind each claim.

## 6. Interview content design

### 6.1 Question categories
1. Opening: "Tell me about yourself" / CV walkthrough / "Why this company?" / "Why Germany?"
2. Behavioural (STAR): conflict with a supplier, missed deadline, data-driven decision, cross-functional project, failure, prioritisation under pressure
3. Supply-chain domain: demand planning and forecasting, inventory policy (safety stock, reorder point, EOQ, ABC/XYZ), procurement and supplier management, logistics and transport (Incoterms, carriers, warehousing), S&OP, KPIs (OTIF, fill rate, inventory turns, forecast accuracy/MAPE), ERP/SAP (MM, SD, APO/IBP), Excel/Power BI, lean and continuous improvement, risk and resilience
4. Case / calculation: short spoken scenarios with numbers ("A key supplier announces a 3-week delay. Walk me through your next 48 hours.")
5. Motivation and fit: career goals, the "5 years" question, why supply chain
6. Closing: his questions for the interviewer

### 6.2 Question bank
- Generated per job ad from the job requirements and CV, plus a fixed curated core bank of about 80 questions in English and German. Each question is tagged with competency, difficulty and language.
- A question's wording is rephrased each time it is reused.

### 6.3 German-market hygiene questions (asked in every HR screen)
- Work-permit status and timeline ("Do you need a visa sponsorship?" / "Wie ist Ihr Aufenthaltsstatus?")
- Salary expectation (Gehaltsvorstellung). The interviewer checks whether his number is realistic for the role and city.
- Earliest start date and notice period
- German level, with a short spontaneous switch into German to test it
- Willingness to relocate or travel

These are cheap to fix and often silently decide the outcome. The report flags weak answers here as **"silent rejecters"**.

## 7. Scoring system

The design goals are **consistency** (the same answer scores the same), **comparability over time**, and **explainability** (every score cites the quote behind it).

### 7.1 Content (per answer, 1–5 on each dimension)
| Dimension | 1 | 5 |
|---|---|---|
| Relevance | Doesn't answer the question | Directly answers and connects it to the role |
| Structure | Rambling, no clear arc | Clear Situation→Task→Action→Result, or a clear framework for case questions |
| Specificity / evidence | Generic, hypothetical | Concrete example with numbers |
| Ownership | "We did…" | Clear personal actions and decisions |
| Domain depth | Buzzwords | Correct, practical supply-chain reasoning |
| Concision | Over 3 min or under 20 s | Right length for the question type |

Content score = the dimension averages, weighted and scaled to 0–100. Case questions add a **correctness** check (e.g. the safety stock logic is right).

### 7.2 Delivery (from audio and transcript; mostly measured numbers, not LLM judgement)
| Metric | Target range (adjustable) |
|---|---|
| Speaking rate | 120–160 wpm in English, 100–140 in German |
| Filler words (uh/um/ähm/also/sozusagen…) | Fewer than 3 per minute |
| Long pauses (over 3 s mid-answer) | Fewer than 2 per answer |
| Answer length | Behavioural 60–120 s; CV walkthrough 60–90 s |
| Talk-time ratio | Candidate 55–70% |
| Vocal energy / tone (Phase 2) | Variation in pitch and energy, no monotone drop at the end of answers. Based on a speech-tone analysis service such as Hume AI, reported as trends, not emotions |

Each metric maps to 0–100 by its distance from the target range. Delivery = the average.

### 7.3 Language
- **German sessions:** an estimated CEFR level (A2–C2) plus sub-scores for fluency, grammar accuracy, vocabulary range (general *and* supply-chain terms), comprehension (did he understand the questions or ask for repeats), and pronunciation (optional Phase 2: Azure Speech Pronunciation Assessment, which supports de-DE).
- **Gap to job:** the estimated level against the level the job ad requires or implies → "meets / gap of 1 level / gap of 2+ levels".
- **English sessions:** a clarity and fluency score, scored the same way, with a lighter weight.

### 7.4 Presence (Phase 3, webcam, measured in the browser)
Observable behaviour only, measured with Google's MediaPipe Face Landmarker running on his laptop:
| Metric | What it means |
|---|---|
| Camera gaze % | Share of speaking time spent looking at or near the camera |
| Gaze breaks when answering | Looking away while thinking (normal) vs constantly (a signal) |
| Smile frequency | At greeting and closing, and overall |
| Head stability / fidgeting | Excessive movement |
| Framing and lighting | A face that is too dark, cut off or off-centre (technical setup) |

**We never infer emotions or "confidence" from the face.** Facial emotion recognition is scientifically unreliable. "You looked at the camera 35% of the time" is accurate and practisable; "you looked nervous" is neither.

### 7.5 Overall score and hiring verdict
- **Overall = Content 45% + Delivery 20% + Language 20% + Presence 15%** (before Phase 3, Presence's weight is spread across the other three). Weights are adjustable per job; for example, Language rises to 30% if the job needs C1 German.
- The **hiring verdict** is a separate holistic judgement by a different "hiring committee" model prompt that reads the transcript and the scores.

### 7.6 Making scores consistent
- The scoring model is pinned to a fixed version and run with temperature 0. The rubric is versioned (`rubric_version`), and trends are only compared within the same rubric version.
- Example answers anchor each rubric level (a 1-, 3- and 5-level answer for each dimension) and are included in the scoring prompt.
- Each answer is scored on its own (no anchoring on earlier answers); then the scores are combined.
- **Repeat test:** before launch, score the same 5 transcripts 3 times. Acceptance: per-dimension variance within ±0.5 and overall within ±5.

## 8. Screens

1. **Home:** readiness by job track, last session's score, open drills, a "Practise now" button
2. **CV:** upload, versions, general review
3. **Job tracks:** a list of job ads. Each one shows its fit review, interview plan, session history and trend
4. **Interview setup:** type, language, length, difficulty, mic/cam check
5. **Live interview room:** the interviewer (a voice wave, later an avatar), a self-view (Phase 3), timer, pause/repeat/end. The transcript is hidden by default for realism, and can be toggled on.
6. **Session report** (§5.5)
7. **Progress:** charts, heatmap, drills
8. **Applications:** the real application log and funnel
9. **Diagnosis:** the root-cause verdict
10. **Settings:** score weights, data retention, languages, the access passcode

The interface is in English, with German interview content. Mobile-friendly, but the interview works best on a laptop.

## 9. Technical approach

### 9.1 Stack
| Layer | Choice | Notes |
|---|---|---|
| Web app | Next.js (App Router) on Vercel | Vercel is already connected |
| Database, file storage, auth | Supabase (Postgres + Storage) | A single user with a magic link or passcode |
| Reasoning (CV review, job-ad extraction, question planning, scoring, reports, diagnosis) | Claude via the Anthropic API | The current Sonnet model for most calls; Opus for the hiring verdict and the diagnosis. Covered by the Max plan's API credit |
| Live voice interview | **ElevenLabs Agents** (Conversational AI) | Handles speech-to-text, turn-taking and natural German/English voices. Uses Claude as the interviewer brain (a built-in model choice or a custom LLM endpoint; to be confirmed in the Phase 1 spike) |
| Fallback for live voice | OpenAI Realtime API | Lowest delay; used if ElevenLabs latency or German quality isn't good enough |
| Delivery analysis | Word-level timed transcription of his recorded audio (Deepgram or Whisper), then our own pause, words-per-minute and filler-word calculations | **Risk:** many transcription models strip fillers like "ähm", so we need a mode that keeps them verbatim (§12) |
| Voice tone (Phase 2) | Hume AI Expression Measurement (speech prosody) | Batch processing after the session |
| German pronunciation (Phase 2, optional) | Azure AI Speech Pronunciation Assessment | |
| Webcam metrics (Phase 3) | MediaPipe Face Landmarker in the browser | Video never leaves the device |
| Video avatar (Phase 3, optional) | Tavus conversational video, or HeyGen interactive avatar | Tavus includes its own perception model; this is the most expensive part (§11) |

### 9.2 Flow of one session
1. The server builds the **interview brief**: the structured CV, the structured job ad, the question plan, the weak points to probe, the persona, the language and the difficulty. This goes into the voice agent's instructions.
2. The browser opens the voice session and, in parallel, records his microphone audio locally (and, in Phase 3, runs MediaPipe and saves metrics every second).
3. When the session ends, the transcript and audio are uploaded (plus the presence metrics in Phase 3).
4. The analysis runs: timed transcription → delivery metrics; Claude scores each answer against the rubric; the language assessment; the hiring verdict; the report is assembled; the tracker and diagnosis are updated.
5. The report page appears when analysis finishes (target: under 2 minutes for a 20-minute session).

### 9.3 Data model (first draft)
- `profile`: the single user's profile: German level, visa status, salary expectation, target cities
- `resume`: version, file, structured JSON, created_at
- `job_ad`: source, raw text, structured JSON (requirements, required German level…), status
- `resume_review`: resume_id, job_ad_id (null means the general review), fit score, results JSON
- `interview_session`: job_ad_id, resume_id, type, language, difficulty, length, rubric_version, started/ended, overall score, verdict
- `turn`: session_id, speaker, text, start/end timestamps, question_id
- `question`: bank question or generated; competency, language, difficulty
- `answer_score`: turn_id, dimension scores, quotes, model answer
- `delivery_metrics`, `language_assessment`, `presence_metrics`: one each per session
- `drill`: session_id, skill, description, status (open / passed)
- `application`: company, role, date, resume_id, job_ad_id, furthest stage, feedback, interview language
- `diagnosis_snapshot`: generated_at, ranked causes, evidence JSON

### 9.4 Privacy and data
- Only he uses it. It is his own data, and he is in Germany, so GDPR applies and we act on it: data is deletable, audio is kept for 30 days by default (configurable down to "delete after analysis"), webcam video is never stored or uploaded, and the vendors used (Anthropic, ElevenLabs, Hume, Deepgram) are listed in Settings.
- The app has a passcode, URLs aren't guessable, and there is no public sharing by default. Reports are exported as files.

## 10. Calibration with a real human

The AI is not a German hiring manager. To trust its scores:
- **Before relying on the Diagnosis:** book 1 mock interview with a real supply-chain professional in Germany (for example from his university's career service, alumni, or LinkedIn). Record it with permission and run it through the same scoring pipeline.
- Compare the human's verdict and main criticisms with the app's. If they broadly agree, trust the app for repeated practice. If they disagree, adjust the rubric anchors and weights.

## 11. Cost estimate

These are vendor prices found in Oct 2026, mostly from third-party summaries. **Confirm them on each vendor's pricing page before budgeting.**

| Item | Rate | Per 30-min session |
|---|---|---|
| ElevenLabs Agents voice | about $0.08–0.10/min platform fee + LLM cost per minute | ~$3–5 |
| Claude for scoring, report and diagnosis | Per token | ~$0.20–0.50 |
| Timed transcription of his audio | about $0.01–0.02/min | ~$0.30–0.60 |
| Hume voice tone (Phase 2) | about $0.02/min audio | ~$0.65 |
| **Voice-only total** | | **≈ $4–7** |
| Tavus video avatar instead (Phase 3) | about $0.26–0.37/min overage; plans from about $22–59/mo | **≈ $8–11 extra** |
| Hosting (Vercel + Supabase) | Free tiers should be enough | $0 |

At about 20 sessions a month, voice-only costs **~$80–140/month**, and a large part of the Claude portion is covered by the Max plan's API credit. With the avatar it is roughly **$250–350/month**.

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| German voice quality or turn-taking feels robotic | Low realism, so less useful practice | Phase 1 spike: test ElevenLabs against OpenAI Realtime in German before building the rest |
| Transcription strips filler words (especially German "ähm", "also") | Delivery metrics read too good | Choose a transcription mode that keeps them verbatim, and test on a real German recording in the spike |
| LLM scores drift or are too generous | Fake progress | Pinned model, rubric anchors, repeat test (§7.6), the human check (§10) |
| He memorises answers to a question bank | Inflated scores | Rephrased questions, re-testing competencies rather than identical questions (F4.8) |
| Feedback too harsh and demotivating | He stops using it | Every report leads with 2 genuine strengths, then the 3 drills; the tone is set to "honest coach" |
| Diagnosis rests on too little real data | Wrong conclusion | Show confidence levels; require at least 5 logged applications and at least 3 sessions before giving high-confidence verdicts |
| Vendor costs creep up | Budget overrun | Per-session cost logging; avatar is optional; length limit per session |

## 13. Phased delivery

### Phase 1: Diagnose and practise by voice (target: about 1 week of build)
- The spike first: German and English voice quality, latency, and filler-word handling in transcription
- CV upload with versions; job ad by paste/upload/URL; CV review (for this job + general)
- Live **voice** interview: all 5 personas, English/German/mixed, probing policy, question variety
- Session report: content scores, language assessment, basic delivery metrics (words per minute, fillers, pauses, length), verdict, 3 drills
- Tracker (trends and drills), application log and funnel, first version of the Diagnosis page
- Single-user passcode, deployed on Vercel

**Acceptance criteria:** he can do a full 20-minute German HR-screen interview end to end. The report arrives within 2 minutes. The repeat test passes. The Diagnosis page shows a ranked verdict once there are at least 5 logged applications and at least 3 sessions.

### Phase 2: Deeper delivery and language analysis
- Voice tone (Hume), German pronunciation assessment, audio playback of an answer next to its score
- A "redo this answer" micro-drill: re-answer one question and get an instant re-score

### Phase 3: Video
- Webcam presence metrics in the browser (MediaPipe)
- Optional video interviewer avatar (Tavus or HeyGen) with an on/off switch per session

## 14. Decisions taken by default (change any of them)

| # | Question | Default chosen |
|---|---|---|
| D1 | Interview language | English, German and mixed are all supported from day one. German is central, since it is a likely cause |
| D2 | Users | Private and single-user: a passcode, no sign-up, no payments |
| D3 | Avatar | Not in v1. Voice first, avatar in Phase 3 |
| D4 | Hosting | Vercel + Supabase, deployed online so he can use it from Germany |
| D5 | Interface language | English (interview content follows the chosen language) |

## 15. Open questions

1. Do you have his **real application history**: roles, companies, how far he got in each, any feedback? Backfilling 20–30 entries gives the Diagnosis real data on day one.
2. Which **German level** does he have (self-rated or certified)? Which kinds of roles does he target (planning, procurement, logistics, analyst; Werkstudent / trainee / full-time)?
3. Should Hossam be able to see the reports (a shared view) or only receive exported reports?
4. What is the monthly budget ceiling? It decides when to turn on the avatar.

---

### Sources for vendor pricing and capabilities (checked 23 Oct 2026)
- ElevenLabs Agents pricing: [Macha](https://www.getmacha.com/blog/elevenlabs-agents-pricing-explained), [CloudZero](https://www.cloudzero.com/blog/elevenlabs-pricing/), [HappyRobot](https://www.happyrobot.ai/hub/elevenlabs-pricing)
- Hume Expression Measurement: [eesel](https://www.eesel.ai/blog/hume-ai-pricing), [FitGap](https://us.fitgap.com/products/hume-ai)
- Tavus: [Tavus pricing](https://www.tavus.io/pricing), [UsagePricing](https://usagepricing.com/blueprint/tavus)
- OpenAI Realtime: [OpenAI pricing](https://openai.com/api/pricing/), [Forasoft](https://www.forasoft.com/article/openai-realtime-api-pricing)
