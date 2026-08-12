-- SJO Games — Supabase schema
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.

-- 1. profiles: one row per signed-up player (auto-created on signup)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player',
  avatar text not null default '🎮',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles are viewable by everyone" on public.profiles for select using (true);
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);

-- 2. player_stats: one row per player, aggregated totals (drives the leaderboard)
create table public.player_stats (
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

alter table public.player_stats enable row level security;
create policy "stats are viewable by everyone" on public.player_stats for select using (true);

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
create policy "users can view own results" on public.game_results for select using (auth.uid() = user_id);

-- 4. auto-create profile + stats row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  insert into public.player_stats (user_id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. record_game_result: the ONLY way results get written.
--    Runs server-side, computes xp/coins itself, so players can't fake rewards
--    from the browser console. Call this from the client via supabase.rpc(...).
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

  v_xp := case p_result when 'win' then 30 when 'draw' then 15 when 'played' then 8 else 8 end
          + least(25, floor(v_score / 100));
  v_coins := case p_result when 'win' then 20 when 'draw' then 10 when 'played' then 5 else 5 end
          + least(15, floor(v_score / 250));

  insert into public.game_results (user_id, game, result, score, xp_earned, coins_earned)
  values (v_user, p_game, p_result, v_score, v_xp, v_coins);

  insert into public.player_stats (user_id, xp, coins, games_played, wins, losses, draws, total_score, streak, best_streak, updated_at)
  values (v_user, v_xp, 100 + v_coins, 1, v_is_win::int, v_is_loss::int, v_is_draw::int, v_score, v_is_win::int, v_is_win::int, now())
  on conflict (user_id) do update set
    xp           = player_stats.xp + v_xp,
    coins        = player_stats.coins + v_coins,
    games_played = player_stats.games_played + 1,
    wins         = player_stats.wins + v_is_win::int,
    losses       = player_stats.losses + v_is_loss::int,
    draws        = player_stats.draws + v_is_draw::int,
    total_score  = player_stats.total_score + v_score,
    streak       = case when v_is_win then player_stats.streak + 1 else 0 end,
    best_streak  = greatest(player_stats.best_streak, case when v_is_win then player_stats.streak + 1 else player_stats.best_streak end),
    updated_at   = now();

  return query select v_xp, v_coins;
end;
$$;

grant execute on function public.record_game_result(text, text, int) to authenticated;

-- 6. public leaderboard view (top players, no emails exposed)
create or replace view public.leaderboard as
select p.display_name, p.avatar, s.xp, s.coins, s.wins, s.games_played, s.best_streak
from public.player_stats s
join public.profiles p on p.id = s.user_id
order by s.xp desc
limit 100;
