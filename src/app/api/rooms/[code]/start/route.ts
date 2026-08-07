import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_players, songs, games } from "@/lib/db/schema";
import { createRoundForGame } from "@/lib/game/round-service";
import { publish, roomChannel } from "@/lib/ably/publish";
import type { RoomSettings } from "@/types/database";

interface StartBody {
  requesterPlayerId: string;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { requesterPlayerId } = (await request.json()) as StartBody;

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.status !== "lobby") return NextResponse.json({ error: "Game already started." }, { status: 409 });
  if (!room.playlist_id) return NextResponse.json({ error: "Pick a playlist before starting." }, { status: 400 });

  const requester = await db.query.room_players.findFirst({
    where: and(eq(room_players.id, requesterPlayerId), eq(room_players.room_id, room.id)),
  });
  if (!requester?.is_host) return NextResponse.json({ error: "Only the host can start the game." }, { status: 403 });

  const [{ count: activeCount }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(room_players)
    .where(
      and(
        eq(room_players.room_id, room.id),
        eq(room_players.is_spectator, false),
        eq(room_players.connection_status, "connected")
      )
    );
  if (activeCount < 2) {
    return NextResponse.json({ error: "Need at least 2 players to start." }, { status: 400 });
  }

  const settings = room.settings as RoomSettings;
  const playlistSongs = await db.query.songs.findMany({ where: eq(songs.playlist_id, room.playlist_id) });

  if (!playlistSongs.length) {
    return NextResponse.json({ error: "Selected playlist has no songs." }, { status: 400 });
  }

  const shuffled = shuffle(playlistSongs.map((s) => s.id));
  const songOrder = Array.from({ length: settings.songCount }, (_, i) => shuffled[i % shuffled.length]);

  const [game] = await db
    .insert(games)
    .values({ room_id: room.id, mode: settings.mode, settings, song_order: songOrder })
    .returning();

  if (!game) {
    return NextResponse.json({ error: "Failed to start game." }, { status: 500 });
  }

  const [updatedRoom] = await db
    .update(rooms)
    .set({ status: "playing", updated_at: new Date().toISOString() })
    .where(eq(rooms.id, room.id))
    .returning();
  await db.update(room_players).set({ score: 0, streak: 0 }).where(eq(room_players.room_id, room.id));

  if (updatedRoom) await publish(roomChannel(room.id), "room_update", updatedRoom);

  const result = await createRoundForGame(game, 1);
  if (!result) return NextResponse.json({ error: "Failed to create first round." }, { status: 500 });

  return NextResponse.json({ game, round: result.round });
}
