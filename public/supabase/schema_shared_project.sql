-- SJO Games — Supabase schema (SHARED with the SJO-ERP portal project)
-- Table/trigger names are prefixed with "game_" so nothing collides with
-- your existing staff/dealer/dealer_staff tables or the auth.users trigger
-- already defined in supabase/google_login_gate.sql.
--
-- Run this once in Supabase Dashboard (project: SJO-ERP) → SQL Editor → New query → Run.

-- 1. game_profiles: one row per player (auto-created on signup, for ANY user —
--    staff/dealer or otherwise — the moment they sign up via auth.users)
create table public.game_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player',
  avatar text not null default '🎮',
  created_at timestamptz not null default now()
);

alter table public.game_profiles enable row level security;
create policy "game_profiles are viewable by everyone" on public.game_profiles for select using (true);
create policy "users can update own game_profile" on public.game_profiles for update using (auth.uid() = id);

-- 2. game_player_stats: aggregated totals per player (drives the leaderboard)
create table public.game_player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0,
  coins integer not null default 100,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  total_score integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.game_player_stats enable row level security;
create policy "game_player_stats are viewable by everyone" on public.game_player_stats for select using (true);

-- 3. game_results: one row per finished game (full history / audit trail)
create table public.game_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,
  result text not null check (result in ('win','loss','draw','played')),
  score integer not null default 0,
  xp_earned integer not null default 0,
  coins_earned integer not null default 0,
  played_at timestamptz not null default now()
);

alter table public.game_results enable row level security;
create policy "users can view own game_results" on public.game_results for select using (auth.uid() = user_id);

-- 4. Auto-create a game_profiles + game_player_stats row whenever ANYONE
--    signs up. Named distinctly (on_auth_user_created_games) so it coexists
--    with your existing google_login_gate.sql trigger on auth.users instead
--    of replacing it — Postgres runs all triggers on a table, not just one.
create or replace function public.handle_new_user_games()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.game_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.game_player_stats (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created_games
  after insert on auth.users
  for each row execute procedure public.handle_new_user_games();

-- 5. record_game_result: the ONLY way results get written.
--    Runs server-side, computes xp/coins itself, so players can't fake
--    rewards from the browser console.
create or replace function public.record_game_result(p_game text, p_result text, p_score int)
returns table(xp_earned int, coins_earned int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp int;
  v_coins int;
  v_user uuid := auth.uid();
  v_score int := greatest(coalesce(p_score, 0), 0);
  v_is_win boolean := p_result = 'win';
  v_is_loss boolean := p_result = 'loss';
  v_is_draw boolean := p_result = 'draw';
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_result not in ('win','loss','draw','played') then
    raise exception 'invalid result';
  end if;

  -- Make sure a stats row exists even if the signup trigger somehow missed it
  -- (e.g. accounts created before this schema was added).
  insert into public.game_player_stats (user_id) values (v_user)
  on conflict (user_id) do nothing;
  insert into public.game_profiles (id) values (v_user)
  on conflict (id) do nothing;

  v_xp := case p_result when 'win' then 30 when 'draw' then 15 when 'played' then 8 else 8 end
          + least(25, floor(v_score / 100));
  v_coins := case p_result when 'win' then 20 when 'draw' then 10 when 'played' then 5 else 5 end
          + least(15, floor(v_score / 250));

  insert into public.game_results (user_id, game, result, score, xp_earned, coins_earned)
  values (v_user, p_game, p_result, v_score, v_xp, v_coins);

  update public.game_player_stats set
    xp           = xp + v_xp,
    coins        = coins + v_coins,
    games_played = games_played + 1,
    wins         = wins + v_is_win::int,
    losses       = losses + v_is_loss::int,
    draws        = draws + v_is_draw::int,
    total_score  = total_score + v_score,
    streak       = case when v_is_win then streak + 1 else 0 end,
    best_streak  = greatest(best_streak, case when v_is_win then streak + 1 else best_streak end),
    updated_at   = now()
  where user_id = v_user;

  return query select v_xp, v_coins;
end;
$$;

grant execute on function public.record_game_result(text, text, int) to authenticated;

-- 6. Public leaderboard view (no emails exposed)
create or replace view public.game_leaderboard as
select p.display_name, p.avatar, s.xp, s.coins, s.wins, s.games_played, s.best_streak
from public.game_player_stats s
join public.game_profiles p on p.id = s.user_id
order by s.xp desc
limit 100;

-- 7. Backfill: create game_profiles/game_player_stats rows for any staff/
--    dealer accounts that already existed BEFORE this schema was added
--    (the trigger above only fires on NEW signups).
insert into public.game_profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

insert into public.game_player_stats (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;
