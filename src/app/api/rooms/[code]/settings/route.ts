import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_players } from "@/lib/db/schema";
import { publish, roomChannel } from "@/lib/ably/publish";
import type { RoomSettings } from "@/types/database";

interface SettingsBody {
  requesterPlayerId: string;
  settings: RoomSettings;
  roomName?: string;
  isPublic?: boolean;
  playlistId?: string | null;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json()) as SettingsBody;

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.status !== "lobby") {
    return NextResponse.json({ error: "Can't change settings after the game has started." }, { status: 409 });
  }

  const requester = await db.query.room_players.findFirst({
    where: and(eq(room_players.id, body.requesterPlayerId), eq(room_players.room_id, room.id)),
  });

  if (!requester?.is_host) {
    return NextResponse.json({ error: "Only the host can change settings." }, { status: 403 });
  }

  const [updated] = await db
    .update(rooms)
    .set({
      settings: body.settings,
      ...(body.roomName ? { name: body.roomName.trim().slice(0, 40) } : {}),
      ...(body.isPublic !== undefined ? { is_public: body.isPublic } : {}),
      ...(body.playlistId !== undefined ? { playlist_id: body.playlistId } : {}),
      updated_at: new Date().toISOString(),
    })
    .where(eq(rooms.id, room.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  await publish(roomChannel(room.id), "room_update", updated);
  return NextResponse.json({ room: updated });
}
