# Kimo — handoff

Last updated: 29 Oct 2026 (commit `055a84b`, live).

## What this is

**Kimo** (repo name Mock-Interview-Buddy) is an interview-practice web app built by Hossam for his brother: an Egyptian MSc student in Germany looking for supply-chain, logistics and operations jobs. He gets interviews but no offers. The app tries to find out why: CV, answer content, delivery, presence, German level, or visa/salary hygiene. It is a family project, so keep it **lean**: no multi-agent build process and no audit loops.

- **Live:** https://kimo-theta.vercel.app. The first account to sign up becomes admin; only the admin edits Integrations.
- **Code:** `Ventures/Mock-Interview-Buddy/app`, a git repo. Remote: `git@github-2:AISamDot/kimo.git` (GitHub reports a move to `AISamDot/Kimo`; pushing still works).
- **Product spec:** `docs/PRD.md`. User-facing overview: `README.md`.

## Ship it

```bash
cd ~/Desktop/Family/Hossam/Ventures/Mock-Interview-Buddy/app
npm test && npm run typecheck && npx eslint src tests && npm run build
git push origin main   # Vercel builds and deploys production (~30–60 s)
```

- `npm install` needs `--legacy-peer-deps`.
- Lint: 9 old warnings (unused `_x` variables) are expected; 0 errors is the bar.
- Local dev: the `mock-interview-buddy` entry in `~/Desktop/Family/Hossam/.claude/launch.json` runs `next dev -p 3200`. With no `DATABASE_URL`, data lives in `./data` (gitignored). The first signup there becomes a local admin.
- A seed script for preview checks (makes no API calls) is described under "Testing".

## Infrastructure

| Piece | Where | Notes |
|---|---|---|
| Hosting | Vercel project `kimo` (`prj_F54IGKFL4KAFWz5CskTrISR4IeUW`, team `team_61hBYDO0oSCMOPJJiyxyjM2C`) | Git-linked to `main`; framework `nextjs`; functions in `fra1`; Standard protection (production public, previews behind Vercel SSO) |
| Database | Supabase project **kimo** (ref `fdjeurxsnhvuvcxobtpa`, Frankfurt, free), org "hos" of Hossam's **second** Supabase account | Transaction pooler `aws-1-eu-central-1.pooler.supabase.com:6543`. Tables `buddy_kv`, `buddy_blobs` (auto-created). RLS on; `anon`/`authenticated` revoked |
| Env vars (Vercel) | `DATABASE_URL` (Sensitive, prod + preview), set by Hossam | `CRON_SECRET`: **may still be pending** (see Open items) |
| Daily cron | `vercel.json` → `GET /api/cron/finder` at 05:00 UTC | Returns 401 unless `Authorization: Bearer $CRON_SECRET` |
| Secrets on disk | `~/.config/kimo/supabase.env` (chmod 600): Supabase PAT, DB password, DATABASE_URL | **Never print or echo these.** Use them only through scripts that print nothing secret. Hossam should revoke the PAT when it's no longer needed |
| API keys | Stored in app settings (Integrations page, admin only), **not** env vars | Anthropic (required), ElevenLabs/OpenAI/Deepgram/Hume/Azure/Tavus (optional), Adzuna (free), Apify (paid, optional) |

The first Supabase account (hossambff) is at its 2-free-project limit. Its "hossambff's Project" (Tokyo) is a different live app; don't touch it.

## Stack and conventions

- **Next.js 16** (App Router, Turbopack, `proxy.ts` instead of middleware, async `params`/`searchParams`, `PageProps<"/route">`). Read `AGENTS.md` and `node_modules/next/dist/docs/` before touching framework APIs.
- **Claude:** `src/lib/llm.ts` `llmJson(zodSchema, {role, system, content, maxTokens})` uses `client.beta.messages.parse` + `betaZodOutputFormat`. Default model `claude-opus-5-5`. All prompts are in `src/lib/ai.ts`.
- **Storage:** `src/lib/store.ts`: `readDb(uid)` / `updateDb(uid, fn)` per user, `readSession` / `updateSession`, `getSettings`. File backend locally, Postgres when `DATABASE_URL` is set. `normalizeUser` merges defaults, so new fields need a default there.
- **Types:** everything is in `src/lib/types.ts`.
- **Tailwind v4 tokens** live in `globals.css`. Turbopack strips `@layer`, so unlayered global rules beat utilities; input colours live on the `.field` class. Use literal class names, not ``bg-${x}``.
- **Mobile:** grids that hold cards need `[&>*]:min-w-0` or they overflow on phones. Check at ~350 px width.
- **Icons:** the file-based icons `src/app/icon.png`, `apple-icon.png`, `favicon.ico` (ICO layers must be RGBA) and `public/kimo-logo.png` are Hossam's Higgsfield caricature of his brother. Don't commit the brother's original photo.

## Feature map (where things live)

| Feature | Key files |
|---|---|
| **Background tasks + tray** (slow Claude work survives navigation) | `lib/tasks.ts` (`startTask` uses `after()`; `runTask` runs inline; stale tasks time out after 330 s), `api/tasks`, `components/TaskTray.tsx` (client store, `useRunningTask(key)`, `RunningNote kinds=[…]`), `components/client.tsx` (`api()` registers any `{task}` response; `ActionButton taskKey`) |
| Task keys | `cvparse:<id>`, `cvreview:<id>`, `jobparse:<id>`, `jobreview:<job>:<cv>`, `prep:<job>`, `stories:mine`, `debrief:<id>`, `diagnosis`, `finder:run`, `finderai:<id>`, `finderimport:<id>` |
| CV | `api/resumes` (upload → task → then runs the finder), `cv/page.tsx`, `lib/cvchecks.ts` (15 free deterministic checks), Claude review in `ai.ts` `generalCvReview` (+12-area `scorecard`, `sixSecondTest`) |
| Job finder | `lib/finder.ts` (`runFinder`, `refreshFinder`, `passesFilters`, `germanOk`, `adzunaPlan`), `lib/jobfit.ts` (local fit score, `germanRequirement` → CEFR / `none` / `unknown`), `components/FinderView.tsx`, `api/finder`, `api/cron/finder`; stale refresh is in `(app)/layout.tsx` → `refreshFinderIfStale` |
| Finder sources | Arbeitnow (keyless, Germany, 10 pages), Adzuna DE (free key, ≤20 calls a run), **Apify** `lib/apify.ts` + `lib/regions.ts`: `valig/linkedin-jobs-scraper` + `valig/indeed-jobs-scraper`, country by country for the chosen regions (Germany, Europe, GCC, Asia, Africa), LinkedIn limited to sector titles, about 400 jobs per source a run, at most once per 20 h unless the regions change |
| Finder prefs | keywords, cities, includeRemote, remoteOnly, entryLevelOnly, minScore, `regions`, `maxGerman` (`none`/A1–B2/`any`, default B2) |
| Mock interviews | `interview/new` + `components/InterviewSetup.tsx`; **no CV or job ad needed**: "Any employer" by default, 20 companies in `lib/companies.ts`, or a job ad. Company tracks are synthetic `Job`s with `job.general`. `api/interview` (plan), `api/interview/[id]/turn`, `components/InterviewRoom.tsx`, `components/Avatar.tsx` |
| Auto end-of-answer | `lib/client/recorder.ts`: rolling-percentile noise floor, at least 2 voiced chunks counts as speech, auto-send after `silenceMs` (default 2.5 s, set on Integrations) once at least 1.2 s of real speech, with a "Sending in Ns" countdown in `InterviewRoom` |
| Scoring/report | `lib/analysis.ts` (`startAnalysis`, already background with session status), `sessions/[id]/page.tsx` |
| **Interview log** | `sessions/page.tsx`: every session, status, score, verdict, summary, CV used |
| Other practice | Story bank (`stories`), quick drills (`practice`, `api/attempts`), German SRS trainer (`german`, `api/phrases`, Leitner boxes in `lib/practice.ts`), prep packs (`jobs/[id]/prep`), real-interview debriefs (`debrief`), diagnosis (`diagnosis`, `lib/diagnosis.ts`), applications tracker |

## Testing

- `npm test`: 70 vitest tests (`tests/`): jobfit, finder (fetch mocked), practice, cvchecks, background (tasks, Adzuna plan, regions, Apify mapping, language filter, companies), vad.
- Preview with seeded data and **no paid calls**: start the dev server, sign up a test user, then run the seed scripts on `data/user/<usr_id>.json`. The previous session kept them in its scratchpad (`seed.mjs`, `seed2.mjs`); they are easy to recreate: a resume, a job, an application, stories, phrases, sample tasks and sessions.
- Without a Claude key, `POST /api/interview` should fail **only** with "Anthropic (Claude) API key is missing". That is a free way to check request validation.
- context-mode hooks block `curl` and inline `node -e` fetches: write `.mjs` scripts to the scratchpad and run them with `node`.

## Working rules (from Hossam)

- **Ask before any paid API call** (Claude, Apify, ElevenLabs, …), including test runs. Free job boards are fine.
- Never publish claude.ai Artifacts; deliverables are local files.
- Concise, structured replies: lead with the answer.
- Don't spoof user agents or get around bot checks (the Arbeitsagentur API returns 403; that's why it isn't a source).
- Writing Vercel secrets through the MCP tools gets blocked by the permission classifier; ask Hossam to set env vars himself.

## Open items

1. **`CRON_SECRET`**: Hossam generated one; confirm he added it in Vercel (Sensitive, Production) and redeployed. Check: `GET /api/cron/finder` with the bearer token should return `{refreshed: n}`; without it, 401.
2. **Nothing paid has run end to end yet** (no Claude key on the live site at last check). The first real runs to watch: CV parse + review (scorecard), interview planning without a CV, the analysis report.
3. **Apify output mapping is unverified.** The actors don't document their fields; `mapApifyItem` tries the common names. After Hossam adds a token, ask before a small paid test, then check that results have title, company, location and URL.
4. **Auto end-of-answer** is unit-tested only. Get feedback from the brother on real mics and tune `voiceThreshold` / `MIN_SPEECH_MS` / `silenceMs` if needed.
5. Offered, not started (needs a yes): per-answer presence feedback, a live eye-contact nudge, private self-replay of video.
6. Tidy-ups: a "General" job track appears under Job ads after the first general interview (by design, but could be hidden); the 9 old lint warnings.
