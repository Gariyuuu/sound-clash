-- ============================================================================
-- Sound Clash — demo seed data
-- Run after 0001_init.sql so you can host a game immediately without first
-- setting up a YouTube API key. Video IDs below were verified against
-- current YouTube search results at the time this was written — YouTube
-- IDs are stable but occasionally a video does get taken down; if a clip
-- fails to load in-game, re-import via Settings -> Playlists -> Import from
-- YouTube, or swap the row's youtube_video_id.
--
-- Note: chorus_lyrics is intentionally left NULL here (no copyrighted lyric
-- text is bundled with this repo). Fill it in yourself with a short original
-- transcription if you want to use Chorus Challenge mode with this playlist.
-- ============================================================================

insert into playlists (id, name, description, source, genre, is_public)
values (
  '00000000-0000-0000-0000-000000000001',
  'Demo Mix — Verified Hits',
  'A hand-picked starter playlist so you can host a game the moment you clone this repo.',
  'youtube',
  'pop',
  true
);

insert into songs (playlist_id, title, artist, featured_artist, album, year, genre, duration_seconds, youtube_video_id, clip_start_seconds)
values
  ('00000000-0000-0000-0000-000000000001', 'Blinding Lights', 'The Weeknd', null, 'After Hours', 2020, 'Synth-pop', 200, '4NRXx6U8ABQ', 45),
  ('00000000-0000-0000-0000-000000000001', 'Uptown Funk', 'Mark Ronson', 'Bruno Mars', 'Uptown Special', 2014, 'Funk', 270, 'OPf0YbXqDm0', 30),
  ('00000000-0000-0000-0000-000000000001', 'Bohemian Rhapsody', 'Queen', null, 'A Night at the Opera', 1975, 'Rock', 355, 'fJ9rUzIMcZQ', 60),
  ('00000000-0000-0000-0000-000000000001', 'Rolling in the Deep', 'Adele', null, '21', 2010, 'Soul', 228, 'rYEDA3JcQqw', 20),
  ('00000000-0000-0000-0000-000000000001', 'Shape of You', 'Ed Sheeran', null, '÷ (Divide)', 2017, 'Pop', 233, 'JGwWNGJdvx8', 25),
  ('00000000-0000-0000-0000-000000000001', 'bad guy', 'Billie Eilish', null, 'When We All Fall Asleep, Where Do We Go?', 2019, 'Electropop', 194, '0AjqljwVusk', 15),
  ('00000000-0000-0000-0000-000000000001', 'Levitating', 'Dua Lipa', 'DaBaby', 'Future Nostalgia', 2020, 'Disco-pop', 203, 'qUiMD_Cm8hw', 30),
  ('00000000-0000-0000-0000-000000000001', 'Billie Jean', 'Michael Jackson', null, 'Thriller', 1982, 'Pop', 294, 'Zi_XLOBDo_Y', 40);
