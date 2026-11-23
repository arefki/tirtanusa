-- TirtaNusa — community water-condition reports (Supabase, free tier)
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Then set these build-time variables:
--   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon/public key>
-- Without them the app stores reports in the visitor's browser (localStorage)
-- and says so in the UI.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  province text not null,
  place text not null default '',
  condition text not null check (condition in ('good', 'murky', 'smelly', 'dry', 'intermittent')),
  text text not null check (char_length(text) >= 10 and char_length(text) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists reports_province_idx on public.reports (province);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

-- Public read: anyone can see reports (this is a public atlas).
create policy "Anyone can read reports"
  on public.reports for select
  using (true);

-- Public insert: anyone can file a report, no account needed.
-- No update/delete for anonymous users.
create policy "Anyone can file a report"
  on public.reports for insert
  with check (true);
