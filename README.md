# Mock Interview Buddy

A private web app for practising supply-chain job interviews in Germany (in English and German), and for finding out **why** applications aren't turning into offers.

- **CV review**: general review for the German market, plus a fit check against each job ad.
- **Job ads**: paste, upload or link. Each ad becomes a practice track.
- **Live mock interview**: two-way voice interview with an animated (or Tavus video) interviewer. It is grounded in the CV and job ad, presses on weak answers, and has 5 interviewer types: HR screen, hiring manager, technical case, German round and pressure round.
- **Analysis**: every answer is scored against a fixed rubric (content). Delivery covers pace, filler words, pauses, voice variety and trailing off. Language gives an estimated CEFR level compared with what the job needs. Webcam presence (eye contact, smiling, steadiness, lighting) is measured in the browser only. Optional extras: vocal expression (Hume) and pronunciation (Azure).
- **Report**: hiring verdict, 3 drills, model answers built from your own experience, silent rejecters (visa, salary, start date), and a comparison with your last session.
- **Progress**: score trends, a skill heatmap, drills that tick themselves off, and readiness per job.
- **Applications and Diagnosis**: log real applications, see your funnel, and get a ranked root-cause diagnosis.
- **Job finder**: pulls live openings in Germany (Arbeitnow, keyless; Adzuna with a free key) and ranks them for free against the CV, German level, seniority and target cities. Remote jobs are supported: open to Germany/EU or worldwide, with a remote-only switch. One click runs a deeper Claude fit check, and another adds the ad as a practice track.
- **Story bank**: STAR stories drafted from the CV and edited by hand, with competency coverage and gaps. The interviewer, scoring and prep packs all reuse them.
- **Quick drills**: answer one question by voice or text and get an instant score. Questions come from your weakest mock answers, real interviews, job ads or the core bank, and the score history per question shows improvement.
- **Prep pack per job**: pitch in English and German, the 8 likely questions mapped to stories, salary, visa and German-level answers, questions to ask, and job phrases. Printable.
- **Real-interview debriefs**: log what was asked and answered after a real interview and get a likely verdict, better answers and red flags. The diagnosis uses these too.
- **German trainer**: spaced-repetition flashcards fed automatically by corrections from mock interviews, plus prep-pack and manual phrases.
- **Today plan**: a countdown to the next real interview (set on Applications) plus a daily checklist.

The product spec is in [docs/PRD.md](docs/PRD.md).

## Run it locally

Requires Node 20.9+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first account you sign up becomes the **admin**. Add API keys on the **Integrations** page; only an Anthropic (Claude) key is required. Data is stored in `./data` (git-ignored).

Use Chrome or Edge for the free browser speech recognition. Microphone and camera work on `localhost` or HTTPS.

## Deploy (Vercel + Postgres)

Local files don't persist on Vercel, so set `DATABASE_URL` to a Postgres database (for example Supabase's transaction pooler URL, port 6543). The app creates its two tables (`buddy_kv`, `buddy_blobs`) on first use. Everything else, including the API keys, is configured in the app itself.

## Accounts

Sign-up and login use email and password. Passwords are hashed with scrypt, sessions use httpOnly cookies, and each user's data is kept separate. The admin manages integrations and can close sign-ups.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (scoring maths, audio analysis, storage) |
| `npm run typecheck` | TypeScript check |

## Costs (approx.)

- Claude: about $0.30–1 per 20-minute interview, including scoring. Quick drill, prep pack, debrief or fit check: a few cents each.
- Job finder ranking and the German trainer: free.
- ElevenLabs or OpenAI voice and transcription: a few dollars per hour of interviews.
- Tavus video avatar: about $0.30/min.
- The browser voice and browser speech recognition are free.

## Privacy

Webcam video never leaves the browser; only aggregate numbers are sent. Answer recordings are kept for 30 days by default (configurable) and can be deleted right after analysis. Users can export or delete all their data from Settings.
