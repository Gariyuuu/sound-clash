import { NextResponse } from "next/server";
import { eq, and, ne, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_players, room_messages } from "@/lib/db/schema";
import { publish, roomChannel } from "@/lib/ably/publish";

interface LeaveBody {
  playerId: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { playerId } = (await request.json()) as LeaveBody;

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const [player] = await db
    .update(room_players)
    .set({ connection_status: "disconnected" })
    .where(and(eq(room_players.id, playerId), eq(room_players.room_id, room.id)))
    .returning();

  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
  await publish(roomChannel(room.id), "player_upsert", player);

  if (player.is_host) {
    const nextHost = await db.query.room_players.findFirst({
      where: and(
        eq(room_players.room_id, room.id),
        eq(room_players.connection_status, "connected"),
        eq(room_players.is_spectator, false),
        ne(room_players.id, playerId)
      ),
      orderBy: asc(room_players.joined_at),
    });

    if (nextHost) {
      await db.update(room_players).set({ is_host: false }).where(eq(room_players.id, playerId));
      const [promoted] = await db
        .update(room_players)
        .set({ is_host: true })
        .where(eq(room_players.id, nextHost.id))
        .returning();
      await db.update(rooms).set({ host_id: nextHost.profile_id }).where(eq(rooms.id, room.id));

      const [message] = await db
        .insert(room_messages)
        .values({
          room_id: room.id,
          kind: "system",
          display_name: "Sound Clash",
          body: `${nextHost.display_name} is now the host`,
        })
        .returning();

      if (promoted) await publish(roomChannel(room.id), "player_upsert", promoted);
      if (message) await publish(roomChannel(room.id), "message", message);
    }
  }

  return NextResponse.json({ success: true });
}
