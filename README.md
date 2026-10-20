# PestLaunch Call Intelligence

**Contents:** [Architecture](#architecture) · [Project structure](#project-structure) · [Setup](#setup) · [Known limitations](#known-limitations) · [What I'd do next](#what-id-do-next) · [Data & privacy](#data--privacy)

---

## Architecture

### How a call is processed

```
Browser
  1. POST /api/calls               create the call, get a one-time upload URL
  2. PUT  <upload URL>             audio goes straight to private storage
  3. POST /api/calls/[id]/process  start processing in the background

Server (background)
  → Transcribe        Deepgram nova-3
                      stereo: split by channel · mono: speaker per word
  → Speaker split     only if a mono call comes back as one speaker
  → Classify          Claude: type, outcome, details, review flags
  → Score & coach     Claude: each scorecard step + quote, coaching
  → Verify & grade    code: quotes checked, points and grade computed

Supabase Postgres → server-rendered pages
```

### Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Data | Supabase Postgres + private Storage bucket |
| Speech to text | Deepgram nova-3 |
| Analysis | Anthropic SDK: structured outputs (Zod), server-side fallback, prompt caching |
| Tests | Vitest |

---

## Project structure

```
src/app/(app)/sales/   Overview, Reps, rep pages, Call Log, call detail
src/app/api/calls/     upload, background processing, status
src/lib/pipeline.ts    claim → transcribe → analyze → score → save
src/lib/transcribe.ts  Deepgram request and transcript shaping
src/lib/analysis/      prompts, schemas, the two Claude passes, speaker split
src/lib/rubrics/       the three scorecards and scoreCall()
src/lib/evidence.ts    quote verification
src/lib/insights.ts    Overview / Reps numbers (close rate, coaching queue…)
src/lib/queries.ts     database reads, including the paged Call Log
supabase/migrations/   schema, row-level security, storage bucket
scripts/               env and DB checks, bulk importer
```

---

## Setup

**You need:** Node.js 20+, a Supabase project, a Deepgram API key and an Anthropic API key.

**1. Install**

```bash
npm install
```

**2. Configure:** copy `.env.example` to `.env.local` and fill in:

| Variable | What it is |
| --- | --- |
| `APP_PASSWORD` | Shared login password |
| `SESSION_SECRET` | Random 32+ character string that signs the session cookie |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-side only) |
| `DEEPGRAM_API_KEY` | Transcription |
| `ANTHROPIC_API_KEY` | Analysis |
| `ANTHROPIC_MODEL` | Optional, defaults to `claude-opus-5-5` |
| `MAX_CALLS` | Demo spend cap on total calls (default 10) |

**3. Create the database:** run `supabase/migrations/0001_init.sql` in the Supabase SQL Editor. It creates the tables, row-level security and the private `recordings` bucket.

**4. Run**

```bash
npm run dev         # then open http://localhost:3000 and log in with APP_PASSWORD
```

---

## Known limitations

- **Scoring may be strict.** Every processed call came out Below standard, so the scorecard steps likely need calibrating with the team.
- **Transcripts aren't perfect.** Mono recordings can mix up who said what, and numbers, prices or names can be misheard. The app flags these for a second look instead of hiding them.
- **No phone-system or CRM data yet.** There are no real call dates, caller ID, answered/missed or response times, and "New Leads" is based on the conversation.

---

## What I'd do next

1. **Put it in front of real users.** The edge cases that matter most only show up with real calls and managers using it day to day. I'd watch how it's used, collect feedback, and fix issues as they come up.
2. **Calibrate scoring with the team.** Agree on what "met" looks like for the most-missed steps, and use managers' corrections to keep improving accuracy.
3. **Connect the phone system and CRM.** Calls arrive automatically with real dates and caller ID, and booked calls flow into the Pipeline tab.
4. **Harden it for production.** Per-user accounts, a more durable processing queue, and stronger duplicate detection.

---

## Data & privacy

- The sample recordings are real customer calls (names, phone numbers, addresses), used only for this evaluation.
- They're stored in a private bucket, read only by the server, and never committed to this repository.
- Transcription runs with Deepgram's model-improvement opt-out (`mip_opt_out=true`). Per Deepgram's documentation, data from opted-out requests is retained only as long as needed to process the request.
- After review, all recordings, database rows and API keys are deleted.
