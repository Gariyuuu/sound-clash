import { NextResponse } from "next/server";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_players } from "@/lib/db/schema";
import { generateRoomCode } from "@/lib/game/room-code";
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from "@/types/database";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

interface CreateRoomBody {
  hostDisplayName: string;
  hostAvatarEmoji: string;
  hostProfileId?: string;
  hostGuestId?: string;
  isPublic?: boolean;
  roomName?: string;
  playlistId?: string;
  settings?: Partial<RoomSettings>;
}

export async function POST(request: Request) {
  const limited = rateLimit(clientKeyFromRequest(request, "rooms:create"), 10, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many rooms created — slow down." }, { status: 429 });
  }

  const body = (await request.json()) as CreateRoomBody;

  if (!body.hostDisplayName?.trim() || (!body.hostProfileId && !body.hostGuestId)) {
    return NextResponse.json({ error: "Missing host identity." }, { status: 400 });
  }

  const settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS, ...body.settings };

  let code = generateRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.query.rooms.findFirst({ where: eq(rooms.code, code) });
    if (!existing) break;
    code = generateRoomCode();
  }

  const [room] = await db
    .insert(rooms)
    .values({
      code,
      host_id: body.hostProfileId ?? null,
      name: body.roomName?.trim() || "Sound Clash Room",
      is_public: body.isPublic ?? false,
      settings,
      playlist_id: body.playlistId ?? null,
    })
    .returning();

  if (!room) {
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }

  let hostPlayer;
  try {
    [hostPlayer] = await db
      .insert(room_players)
      .values({
        room_id: room.id,
        profile_id: body.hostProfileId ?? null,
        guest_id: body.hostProfileId ? null : body.hostGuestId,
        display_name: body.hostDisplayName.trim().slice(0, 20),
        avatar_emoji: body.hostAvatarEmoji || "🎧",
        is_host: true,
      })
      .returning();
  } catch {
    hostPlayer = undefined;
  }

  if (!hostPlayer) {
    await db.delete(rooms).where(eq(rooms.id, room.id));
    return NextResponse.json({ error: "Failed to seat host" }, { status: 500 });
  }

  return NextResponse.json({ room, player: hostPlayer });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);

  const publicRooms = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.is_public, true), eq(rooms.status, "lobby")))
    .orderBy(desc(rooms.created_at))
    .limit(limit);

  if (publicRooms.length === 0) return NextResponse.json({ rooms: [] });

  const counts = await db
    .select({ room_id: room_players.room_id, count: sql<number>`count(*)`.mapWith(Number) })
    .from(room_players)
    .where(
      and(
        inArray(
          room_players.room_id,
          publicRooms.map((r) => r.id)
        ),
        eq(room_players.is_spectator, false)
      )
    )
    .groupBy(room_players.room_id);

  const countByRoom = new Map(counts.map((c) => [c.room_id, c.count]));
  const roomsWithCount = publicRooms.map((r) => ({
    ...r,
    room_players: [{ count: countByRoom.get(r.id) ?? 0 }],
  }));

  return NextResponse.json({ rooms: roomsWithCount });
}
