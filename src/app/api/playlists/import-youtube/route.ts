import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { playlists, songs } from "@/lib/db/schema";
import { resolveYoutubePlaylist } from "@/lib/youtube/resolve";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

interface ImportBody {
  playlistUrl: string;
  name: string;
  ownerId?: string;
  genre?: string;
  decade?: string;
  mood?: string;
  isPublic?: boolean;
}

export async function POST(request: Request) {
  const limited = rateLimit(clientKeyFromRequest(request, "playlists:import"), 5, 60_000);
  if (!limited.success) return NextResponse.json({ error: "Slow down." }, { status: 429 });

  const body = (await request.json()) as ImportBody;
  if (!body.playlistUrl || !body.name?.trim()) {
    return NextResponse.json({ error: "Missing playlist URL or name." }, { status: 400 });
  }

  let resolvedSongs;
  try {
    resolvedSongs = await resolveYoutubePlaylist(body.playlistUrl);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to resolve playlist." }, { status: 400 });
  }

  if (!resolvedSongs.length) return NextResponse.json({ error: "That playlist has no videos." }, { status: 400 });

  const [playlist] = await db
    .insert(playlists)
    .values({
      owner_id: body.ownerId ?? null,
      name: body.name.trim().slice(0, 60),
      source: "youtube",
      genre: body.genre ?? null,
      decade: body.decade ?? null,
      mood: body.mood ?? null,
      is_public: body.isPublic ?? true,
      cover_url: resolvedSongs[0]?.coverUrl ?? null,
    })
    .returning();

  if (!playlist) {
    return NextResponse.json({ error: "Failed to create playlist." }, { status: 500 });
  }

  await db.insert(songs).values(
    resolvedSongs.map((s) => ({
      playlist_id: playlist.id,
      title: s.title,
      artist: s.artist,
      youtube_video_id: s.youtubeVideoId,
      duration_seconds: s.durationSeconds,
      cover_url: s.coverUrl,
      clip_start_seconds: Math.min(30, Math.max(0, Math.floor(s.durationSeconds * 0.25))),
    }))
  );

  return NextResponse.json({ playlist, songCount: resolvedSongs.length });
}
