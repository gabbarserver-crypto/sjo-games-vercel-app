-- SJO Games — automatic cloud backup table
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.

create table if not exists public.sjo_games_backups (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.sjo_games_backups enable row level security;

drop policy if exists "own backup select" on public.sjo_games_backups;
drop policy if exists "own backup insert" on public.sjo_games_backups;
drop policy if exists "own backup update" on public.sjo_games_backups;

create policy "own backup select" on public.sjo_games_backups
  for select using (auth.uid() = user_id);
create policy "own backup insert" on public.sjo_games_backups
  for insert with check (auth.uid() = user_id);
create policy "own backup update" on public.sjo_games_backups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.sjo_games_backups to authenticated;
