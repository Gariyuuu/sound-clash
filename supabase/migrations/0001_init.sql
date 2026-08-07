-- ============================================================================
-- Sound Clash — Initial Schema
-- ============================================================================
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- Answer normalization: strips accents/punctuation/case for fuzzy matching.
-- Used both by the scoring API (via RPC) and by trigram similarity indexes.
-- ----------------------------------------------------------------------------
create or replace function normalize_answer(input text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      regexp_replace(unaccent(lower(coalesce(input, ''))), '&', ' and ', 'g'),
      '[^a-z0-9 ]', '', 'g'
    )
  );
$$;

-- Server-side fuzzy match: exact after normalization, OR trigram similarity
-- above threshold (catches minor typos), OR one string contains the other
-- (catches "weeknd" vs "the weeknd" alias-style abbreviations).
create or replace function fuzzy_match(guess text, answer text, threshold real default 0.55)
returns boolean
language sql
immutable
as $$
  select
    normalize_answer(guess) <> '' and (
      normalize_answer(guess) = normalize_answer(answer)
      or normalize_answer(answer) like '%' || normalize_answer(guess) || '%'
      or normalize_answer(guess) like '%' || normalize_answer(answer) || '%'
      or similarity(normalize_answer(guess), normalize_answer(answer)) >= threshold
    );
$$;

-- ----------------------------------------------------------------------------
-- profiles — one row per authenticated user (extends auth.users)
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 2 and 20),
  avatar_url text,
  avatar_emoji text default '🎧',
  profile_border text default 'default',
  title text default 'Rookie Listener',
  theme text default 'system',
  background_key text default 'neon',
  custom_background_url text,
  xp integer not null default 0,
  level integer not null default 1,
  games_played integer not null default 0,
  wins integer not null default 0,
  total_points bigint not null default 0,
  songs_guessed integer not null default 0,
  correct_answers integer not null default 0,
  total_answers integer not null default 0,
  fastest_buzz_ms integer,
  longest_streak integer not null default 0,
  total_steals integer not null default 0,
  albums_correct integer not null default 0,
  fastest_buzz_wins integer not null default 0,
  game_win_streak integer not null default 0,
  favorite_genre text,
  settings jsonb not null default '{"volume":{"music":80,"ui":60,"effects":80},"accessibility":{"colorblind":false,"highContrast":false,"fontScale":1,"reducedMotion":false}}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_xp_idx on profiles (xp desc);
create index profiles_total_points_idx on profiles (total_points desc);

-- Auto-create a profile row the moment someone signs up, so the rest of the
-- app can assume every authenticated user has one instead of special-casing
-- "no profile yet" everywhere.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  desired_username text;
  final_username text;
  suffix int := 0;
begin
  desired_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    'player'
  );
  desired_username := substring(regexp_replace(desired_username, '[^a-zA-Z0-9_]', '', 'g') from 1 for 20);
  if char_length(desired_username) < 2 then
    desired_username := 'player' || substring(new.id::text from 1 for 6);
  end if;

  final_username := desired_username;
  while exists (select 1 from profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := substring(desired_username from 1 for 16) || suffix::text;
  end loop;

  insert into profiles (id, username) values (new.id, final_username);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- achievements — static catalog + unlocks
-- ----------------------------------------------------------------------------
create table achievements (
  key text primary key,
  name text not null,
  description text not null,
  icon text not null default '🏆',
  xp_reward integer not null default 50
);

create table profile_achievements (
  profile_id uuid not null references profiles(id) on delete cascade,
  achievement_key text not null references achievements(key) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (profile_id, achievement_key)
);

insert into achievements (key, name, description, icon, xp_reward) values
  ('perfect_ear', 'Perfect Ear', 'Guess a song correctly within 1 second of buzzing', '👂', 100),
  ('album_master', 'Album Master', 'Correctly guess 50 albums', '💿', 150),
  ('speed_demon', 'Speed Demon', 'Win 25 rounds with the fastest buzz', '⚡', 150),
  ('steal_king', 'Steal King', 'Successfully steal 25 rounds', '🕵️', 150),
  ('unstoppable', 'Unstoppable', 'Win 10 games in a row', '🔥', 300),
  ('century', '100 Games Played', 'Play 100 games', '💯', 200),
  ('thousand_songs', '1000 Songs Guessed', 'Correctly guess 1000 songs', '🎼', 300),
  ('collector', 'Collector', 'Unlock 10 other achievements', '📦', 100),
  ('music_encyclopedia', 'Music Encyclopedia', 'Reach profile level 25', '📚', 400)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- playlists / songs — song source library (YouTube and/or Spotify backed)
-- ----------------------------------------------------------------------------
create table playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  name text not null,
  description text,
  source text not null check (source in ('youtube', 'spotify', 'mixed')),
  genre text,
  decade text,
  mood text,
  is_public boolean not null default true,
  cover_url text,
  created_at timestamptz not null default now()
);

create table songs (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references playlists(id) on delete cascade,
  title text not null,
  artist text not null,
  featured_artist text,
  album text,
  year integer,
  genre text,
  duration_seconds integer,
  youtube_video_id text,
  spotify_track_id text,
  preview_url text,
  cover_url text,
  chorus_lyrics text,
  clip_start_seconds integer not null default 30,
  created_at timestamptz not null default now()
);

create index songs_playlist_idx on songs (playlist_id);
create index songs_artist_trgm_idx on songs using gin (normalize_answer(artist) gin_trgm_ops);
create index songs_title_trgm_idx on songs using gin (normalize_answer(title) gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- rooms — a lobby/game session identified by a short join code
-- ----------------------------------------------------------------------------
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid references profiles(id) on delete set null,
  name text not null default 'Sound Clash Room',
  is_public boolean not null default false,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  settings jsonb not null default '{}',
  playlist_id uuid references playlists(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_code_idx on rooms (code);
create index rooms_public_lobby_idx on rooms (is_public, status) where status = 'lobby';

create table room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  guest_id text,
  display_name text not null,
  avatar_emoji text not null default '🎧',
  is_host boolean not null default false,
  is_spectator boolean not null default false,
  is_ready boolean not null default false,
  team text,
  score integer not null default 0,
  streak integer not null default 0,
  connection_status text not null default 'connected' check (connection_status in ('connected', 'disconnected', 'kicked', 'banned')),
  joined_at timestamptz not null default now(),
  constraint room_players_identity check (profile_id is not null or guest_id is not null)
);

create unique index room_players_unique_profile on room_players (room_id, profile_id) where profile_id is not null;
create unique index room_players_unique_guest on room_players (room_id, guest_id) where guest_id is not null;
create index room_players_room_idx on room_players (room_id);

-- ----------------------------------------------------------------------------
-- games / rounds — one game per played room session, one row per song round
-- ----------------------------------------------------------------------------
create table games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  mode text not null default 'classic',
  settings jsonb not null default '{}',
  status text not null default 'active' check (status in ('active', 'finished', 'aborted')),
  -- Song order locked in at game start so "next round" is a deterministic
  -- pointer walk rather than a fresh random pick (which could repeat songs).
  song_order uuid[] not null default '{}',
  paused boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  song_id uuid not null references songs(id),
  round_number integer not null,
  chaos_rule text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'playing' check (status in ('playing', 'steal', 'resolved', 'skipped')),
  -- current_phase is the authoritative "which buzz phase is live right now"
  -- pointer for this round (1 = first buzz, 2+ = steal attempts). The buzz
  -- API reads this to know which round_locks row to race for; only the
  -- server-side advance endpoint mutates it.
  current_phase integer not null default 1,
  -- Server-authoritative timestamp for whenever current_phase last changed
  -- (round start, or the start of a steal phase). Clients use this — not
  -- their own Date.now() at the moment they happened to receive the
  -- realtime event — to compute the buzz-window countdown, so a client that
  -- reconnects or a host that gets promoted mid-steal-phase resumes the
  -- correct remaining time instead of restarting a full countdown.
  phase_started_at timestamptz not null default now(),
  excluded_player_ids uuid[] not null default '{}',
  -- Sanitized payloads only — never contains song title/artist/album/lyrics.
  -- Populated by the server (service-role) when a round starts / resolves,
  -- and safe to expose via a public RLS select policy + realtime subscription
  -- because the raw `songs` row itself is never publicly readable.
  broadcast_payload jsonb,
  reveal_payload jsonb,
  revealed_hints jsonb not null default '[]'
);

create index game_rounds_game_idx on game_rounds (game_id);

-- Atomic buzz arbitration: first successful insert per (round_id, phase) wins
-- the buzz lock. phase 1 = initial buzz, phase 2+ = steal rounds. This is the
-- server-authoritative mechanism that prevents duplicate/tampered buzzes —
-- concurrent clients race an INSERT ... ON CONFLICT DO NOTHING and only one
-- request can ever win a given (round_id, phase) pair.
create table round_locks (
  round_id uuid not null references game_rounds(id) on delete cascade,
  phase integer not null default 1,
  player_id uuid not null references room_players(id) on delete cascade,
  buzzed_at timestamptz not null default now(),
  client_latency_ms integer not null default 0,
  primary key (round_id, phase)
);

create table round_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references game_rounds(id) on delete cascade,
  -- Denormalized from game_rounds.game_id so clients can filter the
  -- round_answers realtime subscription to just their own game — see
  -- use-game-realtime.ts. Without this, that subscription would receive
  -- every concurrent game's answer events project-wide.
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references room_players(id) on delete cascade,
  phase integer not null default 1,
  category text not null check (category in ('title', 'artist', 'featured_artist', 'album', 'chorus')),
  guess text not null,
  correct boolean not null,
  points integer not null default 0,
  answered_at timestamptz not null default now()
);

create index round_answers_round_idx on round_answers (round_id);
create index round_answers_game_idx on round_answers (game_id);

-- ----------------------------------------------------------------------------
-- match_history — denormalized snapshot for fast leaderboard / replay reads
-- ----------------------------------------------------------------------------
create table match_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  mode text not null,
  players jsonb not null,
  winner_profile_id uuid references profiles(id) on delete set null,
  round_count integer not null,
  duration_seconds integer not null,
  timeline jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index match_history_created_idx on match_history (created_at desc);

-- ----------------------------------------------------------------------------
-- room_messages — lobby chat + emoji reactions, DB-driven realtime (no
-- separate broadcast-channel infrastructure needed; clients subscribe to
-- postgres_changes INSERT events filtered by room_id).
-- ----------------------------------------------------------------------------
create table room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid references room_players(id) on delete set null,
  display_name text not null,
  kind text not null check (kind in ('chat', 'reaction', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);

create index room_messages_room_idx on room_messages (room_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table profile_achievements enable row level security;
alter table playlists enable row level security;
alter table songs enable row level security;
alter table rooms enable row level security;
alter table room_players enable row level security;
alter table games enable row level security;
alter table game_rounds enable row level security;
alter table round_locks enable row level security;
alter table round_answers enable row level security;
alter table match_history enable row level security;
alter table room_messages enable row level security;

create policy "profiles are publicly readable" on profiles for select using (true);
create policy "users manage their own profile" on profiles for update using (auth.uid() = id);
create policy "users insert their own profile" on profiles for insert with check (auth.uid() = id);

create policy "achievements publicly readable" on profile_achievements for select using (true);

create policy "playlists publicly readable" on playlists for select using (is_public or owner_id = auth.uid());
create policy "owners manage playlists" on playlists for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Intentionally NO public select policy on `songs`. Song answer fields
-- (title/artist/album/lyrics) must never be directly queryable by a player's
-- browser mid-round — the sanitized RoundBroadcastPayload (no answer fields)
-- is the only thing gameplay clients ever see, and it's assembled server-side
-- by API routes using the service-role client, which bypasses RLS entirely.
-- Playlist *browsing* (before a game starts, e.g. host reviewing a playlist)
-- also goes through an API route rather than a direct table read, so a
-- "browse mode" RLS carve-out isn't needed here.

create policy "rooms publicly readable" on rooms for select using (true);
create policy "anyone can create rooms" on rooms for insert with check (true);
create policy "host updates room" on rooms for update using (true);

create policy "room players readable" on room_players for select using (true);
create policy "anyone can join a room" on room_players for insert with check (true);
create policy "players update own row" on room_players for update using (true);

create policy "games readable" on games for select using (true);
create policy "games writable" on games for all using (true) with check (true);

-- game_rounds IS publicly readable — song_id is an opaque foreign key and
-- `songs` itself has no public select policy, so a bare song_id leaks
-- nothing. broadcast_payload/reveal_payload are curated server-side to
-- exclude answer fields until it's safe to reveal them.
create policy "rounds readable" on game_rounds for select using (true);
create policy "rounds writable" on game_rounds for all using (true) with check (true);

create policy "locks readable" on round_locks for select using (true);
create policy "locks writable" on round_locks for insert with check (true);

-- round_answers.guess is a player's submitted text, not the canonical
-- answer, so it's safe to read publicly (used for the live "who guessed
-- what" feed) — but only after the fact, driven by the API route insert.
create policy "answers readable" on round_answers for select using (true);
create policy "answers writable" on round_answers for insert with check (true);

create policy "match history publicly readable" on match_history for select using (true);
create policy "match history writable" on match_history for insert with check (true);

create policy "room messages readable" on room_messages for select using (true);
create policy "room messages writable" on room_messages for insert with check (true);

-- NOTE: Because rooms are joinable by short code without Supabase Auth (guest
-- play), most write policies above are intentionally permissive at the RLS
-- layer — the real authorization boundary is the Next.js API routes, which
-- use the Supabase service-role key and enforce host-only actions, one-buzz-
-- per-player, and server-computed scoring. Do not expose the service-role
-- key to the client.

-- ----------------------------------------------------------------------------
-- Realtime: enable postgres_changes streaming for tables the client
-- subscribes to directly (lobby presence, buzz race, round state, chat).
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table room_players;
alter publication supabase_realtime add table room_messages;
alter publication supabase_realtime add table game_rounds;
alter publication supabase_realtime add table round_locks;
alter publication supabase_realtime add table round_answers;
