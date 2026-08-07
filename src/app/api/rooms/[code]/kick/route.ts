import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_players, room_messages } from "@/lib/db/schema";
import { publish, roomChannel } from "@/lib/ably/publish";

interface KickBody {
  requesterPlayerId: string;
  targetPlayerId: string;
  ban?: boolean;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json()) as KickBody;

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const requester = await db.query.room_players.findFirst({
    where: and(eq(room_players.id, body.requesterPlayerId), eq(room_players.room_id, room.id)),
  });

  if (!requester?.is_host) {
    return NextResponse.json({ error: "Only the host can remove players." }, { status: 403 });
  }

  if (body.requesterPlayerId === body.targetPlayerId) {
    return NextResponse.json({ error: "Host can't remove themselves." }, { status: 400 });
  }

  const [target] = await db
    .update(room_players)
    .set({ connection_status: body.ban ? "banned" : "kicked" })
    .where(and(eq(room_players.id, body.targetPlayerId), eq(room_players.room_id, room.id)))
    .returning();

  if (!target) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  const [message] = await db
    .insert(room_messages)
    .values({
      room_id: room.id,
      kind: "system",
      display_name: "Sound Clash",
      body: `${target.display_name} was ${body.ban ? "banned" : "kicked"} by the host`,
    })
    .returning();

  await publish(roomChannel(room.id), "player_upsert", target);
  if (message) await publish(roomChannel(room.id), "message", message);

  return NextResponse.json({ player: target });
}
