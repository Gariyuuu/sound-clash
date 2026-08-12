import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db, safeQuery } from "@/lib/db/client";
import { songs } from "@/lib/db/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rows = await safeQuery(
    () =>
      db
        .select({
          id: songs.id,
          title: songs.title,
          artist: songs.artist,
          album: songs.album,
          year: songs.year,
          genre: songs.genre,
          duration_seconds: songs.duration_seconds,
          cover_url: songs.cover_url,
        })
        .from(songs)
        .where(eq(songs.playlist_id, id))
        .orderBy(asc(songs.created_at)),
    []
  );

  return NextResponse.json({ songs: rows });
}
