import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_players, room_messages } from "@/lib/db/schema";
import { publish, roomChannel } from "@/lib/ably/publish";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

const MAX_PLAYERS = 20;

interface JoinBody {
  displayName: string;
  avatarEmoji: string;
  profileId?: string;
  guestId?: string;
  isSpectator?: boolean;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const limited = rateLimit(clientKeyFromRequest(request, "rooms:join"), 20, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many join attempts — slow down." }, { status: 429 });
  }

  const { code } = await params;
  const body = (await request.json()) as JoinBody;

  if (!body.displayName?.trim() || (!body.profileId && !body.guestId)) {
    return NextResponse.json({ error: "Missing identity." }, { status: 400 });
  }

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  // Already seated? (rejoin after refresh/reconnect)
  const existing = await db.query.room_players.findFirst({
    where: and(
      eq(room_players.room_id, room.id),
      body.profileId ? eq(room_players.profile_id, body.profileId) : eq(room_players.guest_id, body.guestId!)
    ),
  });

  if (existing) {
    if (existing.connection_status === "banned") {
      return NextResponse.json({ error: "You have been banned from this room." }, { status: 403 });
    }
    const [updated] = await db
      .update(room_players)
      .set({ connection_status: "connected" })
      .where(eq(room_players.id, existing.id))
      .returning();
    const player = updated ?? existing;
    await publish(roomChannel(room.id), "player_upsert", player);
    return NextResponse.json({ room, player });
  }

  if (room.status !== "lobby" && !body.isSpectator) {
    return NextResponse.json(
      { error: "Game already in progress — you can join as a spectator." },
      { status: 409 }
    );
  }

  if (!body.isSpectator) {
    const activePlayers = await db.query.room_players.findMany({
      where: and(
        eq(room_players.room_id, room.id),
        eq(room_players.is_spectator, false),
        eq(room_players.connection_status, "connected")
      ),
    });
    if (activePlayers.length >= MAX_PLAYERS) {
      return NextResponse.json({ error: "Room is full (20 players max)." }, { status: 409 });
    }
  }

  const [player] = await db
    .insert(room_players)
    .values({
      room_id: room.id,
      profile_id: body.profileId ?? null,
      guest_id: body.profileId ? null : body.guestId,
      display_name: body.displayName.trim().slice(0, 20),
      avatar_emoji: body.avatarEmoji || "🎧",
      is_spectator: body.isSpectator ?? false,
    })
    .returning();

  if (!player) {
    return NextResponse.json({ error: "Failed to join." }, { status: 500 });
  }

  const [message] = await db
    .insert(room_messages)
    .values({
      room_id: room.id,
      player_id: player.id,
      display_name: player.display_name,
      kind: "system",
      body: `${player.display_name} joined the room`,
    })
    .returning();

  await publish(roomChannel(room.id), "player_upsert", player);
  if (message) await publish(roomChannel(room.id), "message", message);

  return NextResponse.json({ room, player });
}
