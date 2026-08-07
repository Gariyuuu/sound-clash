import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_players } from "@/lib/db/schema";
import { publish, roomChannel } from "@/lib/ably/publish";

interface TeamBody {
  requesterPlayerId: string;
  targetPlayerId: string;
  team: string | null;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { requesterPlayerId, targetPlayerId, team } = (await request.json()) as TeamBody;

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.status !== "lobby") return NextResponse.json({ error: "Can't change teams after the game has started." }, { status: 409 });

  const requester = await db.query.room_players.findFirst({
    where: and(eq(room_players.id, requesterPlayerId), eq(room_players.room_id, room.id)),
  });
  if (!requester?.is_host) return NextResponse.json({ error: "Only the host can assign teams." }, { status: 403 });

  const [player] = await db
    .update(room_players)
    .set({ team })
    .where(and(eq(room_players.id, targetPlayerId), eq(room_players.room_id, room.id)))
    .returning();

  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
  await publish(roomChannel(room.id), "player_upsert", player);
  return NextResponse.json({ player });
}
