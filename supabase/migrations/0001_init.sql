-- PestLaunch Call Intelligence — initial schema
-- Run once in Supabase → SQL Editor.
--
-- Security model: the browser never talks to Supabase. Only the Next.js server
-- does, using the service_role key. So: RLS is ON with no policies (anon /
-- authenticated can read nothing), and only service_role is granted access.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- calls: one row per recording and its processing status
-- ---------------------------------------------------------------------------
create table public.calls (
  id                uuid primary key default gen_random_uuid(),
  label             text not null,                       -- e.g. "CALL-014"
  original_filename text,
  storage_path      text,                                -- path in the "recordings" bucket
  duration_sec      numeric(8, 2),
  channels          smallint,                            -- 1 = mono, 2 = stereo (rep/customer split)
  call_at           timestamptz,                         -- when the call happened, if known
  status            text not null default 'uploaded'
                    check (status in ('uploaded', 'transcribing', 'analyzing', 'complete', 'failed')),
  failed_stage      text check (failed_stage in ('upload', 'transcribe', 'analyze')),
  error             text,
  transcribed_at    timestamptz,
  analyzed_at       timestamptz,
  is_demo           boolean not null default false,      -- synthetic sample data, removable
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index calls_created_at_idx on public.calls (created_at desc);
create index calls_status_idx on public.calls (status);

create trigger calls_set_updated_at
  before update on public.calls
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- transcripts: speaker-separated utterances from Deepgram
-- ---------------------------------------------------------------------------
create table public.transcripts (
  call_id       uuid primary key references public.calls (id) on delete cascade,
  mode          text not null check (mode in ('diarize', 'multichannel')),
  -- [{ "speaker": 0, "start": 1.2, "end": 4.8, "text": "...", "confidence": 0.97 }, ...]
  utterances    jsonb not null default '[]'::jsonb,
  rep_speaker   smallint,                                -- which speaker index is the rep
  provider      text not null default 'deepgram',
  provider_meta jsonb,                                   -- model, request id, duration (no audio)
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reps: office staff detected from greetings (or set by a manager)
-- ---------------------------------------------------------------------------
create table public.reps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create unique index reps_name_lower_idx on public.reps (lower(name));

-- ---------------------------------------------------------------------------
-- analyses: classification, outcome, rubric score and coaching per call
-- ---------------------------------------------------------------------------
create table public.analyses (
  call_id           uuid primary key references public.calls (id) on delete cascade,
  rep_id            uuid references public.reps (id) on delete set null,
  rep_name          text,
  company           text,
  caller_name       text,

  call_type         text not null
                    check (call_type in ('sales', 'service', 'billing', 'retention', 'other')),
  call_subtype      text,                                -- e.g. "re-service", "reschedule", "card update"
  type_confidence   numeric(4, 3),
  scorable          boolean not null default true,
  unscorable_reason text,                                -- e.g. "voicemail", "wrong number"

  summary           text,
  outcome           jsonb not null default '{}'::jsonb,  -- type-specific: booked/saved/resolved, price, reason...
  details           jsonb not null default '{}'::jsonb,  -- pests, objections, offers made, dates...

  rubric_id         text check (rubric_id in ('sales', 'all_calls', 'retention')),
  rubric_version    text,
  -- [{ "id": "validate", "status": "met"|"not_met"|"na", "points": 1, "evidence": "...",
  --    "evidence_start": 12.3, "evidence_verified": true, "reason": "..." }, ...]
  items             jsonb not null default '[]'::jsonb,
  score             smallint,                            -- computed in code, never by the model
  max_score         smallint,
  grade             text check (grade in ('gold', 'green', 'below')),

  -- { "strengths": [...], "fixes": [{ "item_id", "what", "why", "say_this", "at" }], ... }
  coaching          jsonb not null default '{}'::jsonb,

  needs_review      boolean not null default false,
  review_reasons    text[] not null default '{}',
  overrides         jsonb not null default '{}'::jsonb,  -- manager changes to type / rep

  model             text,
  prompt_version    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index analyses_call_type_idx on public.analyses (call_type);
create index analyses_grade_idx on public.analyses (grade);
create index analyses_rep_id_idx on public.analyses (rep_id);

create trigger analyses_set_updated_at
  before update on public.analyses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access control: service_role only
-- ---------------------------------------------------------------------------
alter table public.calls       enable row level security;
alter table public.transcripts enable row level security;
alter table public.reps        enable row level security;
alter table public.analyses    enable row level security;

revoke all on public.calls, public.transcripts, public.reps, public.analyses from anon, authenticated;
grant select, insert, update, delete on public.calls, public.transcripts, public.reps, public.analyses to service_role;

revoke execute on function public.set_updated_at() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for recordings (played back via short-lived signed URLs)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings',
  'recordings',
  false,
  52428800, -- 50 MB
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
)
on conflict (id) do nothing;
