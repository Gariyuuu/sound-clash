/**
 * Demo seed data — run after `npm run db:push` so you can host a game
 * immediately without first setting up a YouTube/Spotify API key.
 *
 * Replaces the old `supabase/seed.sql` (kept in the repo only as historical
 * reference). Video IDs below were verified against current YouTube search
 * results at the time this was written — YouTube IDs are stable but
 * occasionally a video does get taken down; if a clip fails to load
 * in-game, re-import via Settings -> Playlists -> Import from YouTube.
 *
 * chorus_lyrics is intentionally left null (no copyrighted lyric text is
 * bundled with this repo).
 *
 * Does not import "@/lib/db/client" because that file is `import
 * "server-only"`-guarded for use inside Next.js request handlers — this
 * script runs standalone via `npm run db:seed` (tsx), so it opens its own
 * connection instead.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

const DEMO_PLAYLIST_ID = "00000000-0000-0000-0000-000000000001";

const DEMO_SONGS = [
  { title: "Blinding Lights", artist: "The Weeknd", featured_artist: null, album: "After Hours", year: 2020, genre: "Synth-pop", duration_seconds: 200, youtube_video_id: "4NRXx6U8ABQ", clip_start_seconds: 45 },
  { title: "Uptown Funk", artist: "Mark Ronson", featured_artist: "Bruno Mars", album: "Uptown Special", year: 2014, genre: "Funk", duration_seconds: 270, youtube_video_id: "OPf0YbXqDm0", clip_start_seconds: 30 },
  { title: "Bohemian Rhapsody", artist: "Queen", featured_artist: null, album: "A Night at the Opera", year: 1975, genre: "Rock", duration_seconds: 355, youtube_video_id: "fJ9rUzIMcZQ", clip_start_seconds: 60 },
  { title: "Rolling in the Deep", artist: "Adele", featured_artist: null, album: "21", year: 2010, genre: "Soul", duration_seconds: 228, youtube_video_id: "rYEDA3JcQqw", clip_start_seconds: 20 },
  { title: "Shape of You", artist: "Ed Sheeran", featured_artist: null, album: "÷ (Divide)", year: 2017, genre: "Pop", duration_seconds: 233, youtube_video_id: "JGwWNGJdvx8", clip_start_seconds: 25 },
  { title: "bad guy", artist: "Billie Eilish", featured_artist: null, album: "When We All Fall Asleep, Where Do We Go?", year: 2019, genre: "Electropop", duration_seconds: 194, youtube_video_id: "0AjqljwVusk", clip_start_seconds: 15 },
  { title: "Levitating", artist: "Dua Lipa", featured_artist: "DaBaby", album: "Future Nostalgia", year: 2020, genre: "Disco-pop", duration_seconds: 203, youtube_video_id: "qUiMD_Cm8hw", clip_start_seconds: 30 },
  { title: "Billie Jean", artist: "Michael Jackson", featured_artist: null, album: "Thriller", year: 1982, genre: "Pop", duration_seconds: 294, youtube_video_id: "Zi_XLOBDo_Y", clip_start_seconds: 40 },
];

const ACHIEVEMENTS = [
  { key: "perfect_ear", name: "Perfect Ear", description: "Guess a song correctly within 1 second of buzzing", icon: "👂", xp_reward: 100 },
  { key: "album_master", name: "Album Master", description: "Correctly guess 50 albums", icon: "💿", xp_reward: 150 },
  { key: "speed_demon", name: "Speed Demon", description: "Win 25 rounds with the fastest buzz", icon: "⚡", xp_reward: 150 },
  { key: "steal_king", name: "Steal King", description: "Successfully steal 25 rounds", icon: "🕵️", xp_reward: 150 },
  { key: "unstoppable", name: "Unstoppable", description: "Win 10 games in a row", icon: "🔥", xp_reward: 300 },
  { key: "century", name: "100 Games Played", description: "Play 100 games", icon: "💯", xp_reward: 200 },
  { key: "thousand_songs", name: "1000 Songs Guessed", description: "Correctly guess 1000 songs", icon: "🎼", xp_reward: 300 },
  { key: "collector", name: "Collector", description: "Unlock 10 other achievements", icon: "📦", xp_reward: 100 },
  { key: "music_encyclopedia", name: "Music Encyclopedia", description: "Reach profile level 25", icon: "📚", xp_reward: 400 },
];

async function main() {
  await db.insert(schema.achievements).values(ACHIEVEMENTS).onConflictDoNothing({ target: schema.achievements.key });

  await db
    .insert(schema.playlists)
    .values({
      id: DEMO_PLAYLIST_ID,
      name: "Demo Mix — Verified Hits",
      description: "A hand-picked starter playlist so you can host a game the moment you clone this repo.",
      source: "youtube",
      genre: "pop",
      is_public: true,
    })
    .onConflictDoNothing({ target: schema.playlists.id });

  const existingSongs = await db.query.songs.findMany({ where: (s, { eq }) => eq(s.playlist_id, DEMO_PLAYLIST_ID) });
  if (existingSongs.length === 0) {
    await db.insert(schema.songs).values(DEMO_SONGS.map((s) => ({ ...s, playlist_id: DEMO_PLAYLIST_ID })));
  }

  console.log(`Seeded ${ACHIEVEMENTS.length} achievements and ${DEMO_SONGS.length} demo songs.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
