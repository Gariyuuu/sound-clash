import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_players } from "@/lib/db/schema";
import { publish, roomChannel } from "@/lib/ably/publish";

interface ReadyBody {
  playerId: string;
  isReady: boolean;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { playerId, isReady } = (await request.json()) as ReadyBody;

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const [player] = await db
    .update(room_players)
    .set({ is_ready: isReady })
    .where(and(eq(room_players.id, playerId), eq(room_players.room_id, room.id)))
    .returning();

  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
  await publish(roomChannel(room.id), "player_upsert", player);
  return NextResponse.json({ player });
}
