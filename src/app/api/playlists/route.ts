import { NextResponse } from "next/server";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { playlists, songs } from "@/lib/db/schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const genre = url.searchParams.get("genre");
  const decade = url.searchParams.get("decade");
  const mood = url.searchParams.get("mood");
  const ownerId = url.searchParams.get("ownerId");

  const conditions = [ownerId ? eq(playlists.owner_id, ownerId) : eq(playlists.is_public, true)];
  if (genre) conditions.push(eq(playlists.genre, genre));
  if (decade) conditions.push(eq(playlists.decade, decade));
  if (mood) conditions.push(eq(playlists.mood, mood));

  const rows = await db
    .select()
    .from(playlists)
    .where(and(...conditions))
    .orderBy(desc(playlists.created_at))
    .limit(60);

  const counts = rows.length
    ? await db
        .select({ playlist_id: songs.playlist_id, count: sql<number>`count(*)`.mapWith(Number) })
        .from(songs)
        .where(inArray(songs.playlist_id, rows.map((r) => r.id)))
        .groupBy(songs.playlist_id)
    : [];
  const countByPlaylist = new Map(counts.map((c) => [c.playlist_id, c.count]));

  const result = rows.map((p) => ({ ...p, songs: [{ count: countByPlaylist.get(p.id) ?? 0 }] }));

  return NextResponse.json({ playlists: result });
}
