# Mock Interview Buddy

A private web app for practising supply-chain job interviews in Germany (in English and German), and for finding out **why** applications aren't turning into offers.

- **CV review**: general review for the German market, plus a fit check against each job ad.
- **Job ads**: paste, upload or link. Each ad becomes a practice track.
- **Live mock interview**: two-way voice interview with an animated (or Tavus video) interviewer. It is grounded in the CV and job ad, presses on weak answers, and has 5 interviewer types: HR screen, hiring manager, technical case, German round and pressure round.
- **Analysis**: every answer is scored against a fixed rubric (content). Delivery covers pace, filler words, pauses, voice variety and trailing off. Language gives an estimated CEFR level compared with what the job needs. Webcam presence (eye contact, smiling, steadiness, lighting) is measured in the browser only. Optional extras: vocal expression (Hume) and pronunciation (Azure).
- **Report**: hiring verdict, 3 drills, model answers built from your own experience, silent rejecters (visa, salary, start date), and a comparison with your last session.
- **Progress**: score trends, a skill heatmap, drills that tick themselves off, and readiness per job.
- **Applications and Diagnosis**: log real applications, see your funnel, and get a ranked root-cause diagnosis.

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

- Claude: about $0.30–1 per 20-minute interview, including scoring.
- ElevenLabs or OpenAI voice and transcription: a few dollars per hour of interviews.
- Tavus video avatar: about $0.30/min.
- The browser voice and browser speech recognition are free.

## Privacy

Webcam video never leaves the browser; only aggregate numbers are sent. Answer recordings are kept for 30 days by default (configurable) and can be deleted right after analysis. Users can export or delete all their data from Settings.
