import type { SongRow, RoomSettings } from "@/types/database";
import type { RoundBroadcastPayload, RoundRevealPayload, RevealedHint } from "@/lib/game/types";

/**
 * Builds the sanitized payload persisted to game_rounds.broadcast_payload.
 * MUST NOT include any answer field (title/artist/album/lyrics) — this is
 * the only representation of the round that gameplay clients ever see
 * before it resolves, since `songs` has no public RLS select policy.
 */
export function buildBroadcastPayload(opts: {
  roundId: string;
  roundNumber: number;
  totalRounds: number;
  song: SongRow;
  settings: RoomSettings;
  timerSeconds: number;
}): RoundBroadcastPayload {
  const { roundId, roundNumber, totalRounds, song, settings, timerSeconds } = opts;

  const clipDurationSeconds =
    settings.mode === "one_second" ? 1 : settings.mode === "hard_mode" ? 5 : 15;

  return {
    roundId,
    roundNumber,
    totalRounds,
    categories: settings.categories,
    timerSeconds,
    serverStartedAt: new Date().toISOString(),
    clipStartSeconds: settings.mode === "reverse_intro" ? 0 : song.clip_start_seconds,
    clipDurationSeconds,
    youtubeVideoId: settings.source !== "spotify" ? song.youtube_video_id : null,
    spotifyPreviewUrl: settings.source !== "youtube" ? song.preview_url : null,
    coverUrlBlurred: song.cover_url,
    mode: settings.mode,
  };
}

export function buildRevealPayload(song: SongRow): RoundRevealPayload {
  return {
    title: song.title,
    artist: song.artist,
    featuredArtist: song.featured_artist,
    album: song.album,
    year: song.year,
    coverUrl: song.cover_url,
  };
}

export function buildHint(kind: RevealedHint["kind"], song: SongRow): RevealedHint {
  switch (kind) {
    case "first_letter":
      return { kind, value: song.title.trim()[0]?.toUpperCase() ?? "?" };
    case "last_letter":
      return { kind, value: song.title.trim().slice(-1).toUpperCase() };
    case "year":
      return { kind, value: song.year ? String(song.year) : "Unknown" };
    case "genre":
      return { kind, value: song.genre ?? "Unknown" };
    case "duration":
      return {
        kind,
        value: song.duration_seconds
          ? `${Math.floor(song.duration_seconds / 60)}:${String(song.duration_seconds % 60).padStart(2, "0")}`
          : "Unknown",
      };
    case "cover_blur":
      return { kind, value: song.cover_url ?? "" };
    case "random_letters": {
      const letters = song.title.replace(/[^a-zA-Z]/g, "");
      const sampleCount = Math.max(1, Math.floor(letters.length * 0.3));
      const indices = new Set<number>();
      while (indices.size < sampleCount && indices.size < letters.length) {
        indices.add(Math.floor(Math.random() * letters.length));
      }
      const revealed = song.title
        .split("")
        .map((ch, i) => {
          if (!/[a-zA-Z]/.test(ch)) return ch;
          const letterIndex = song.title.slice(0, i).replace(/[^a-zA-Z]/g, "").length;
          return indices.has(letterIndex) ? ch : "_";
        })
        .join("");
      return { kind, value: revealed };
    }
    case "artist_silhouette":
      return { kind, value: song.artist[0] + "•".repeat(Math.max(0, song.artist.length - 1)) };
    case "word_count":
      return { kind, value: String(song.title.trim().split(/\s+/).length) };
    default:
      return { kind, value: "" };
  }
}
