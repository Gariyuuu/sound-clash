import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_players } from "@/lib/db/schema";
import { publish, roomChannel } from "@/lib/ably/publish";
import { AI_BOT_AVATAR, AI_BOT_DISPLAY_NAME, AI_BOT_GUEST_ID } from "@/lib/game/ai-bot";
import type { AIDifficulty, RoomSettings } from "@/types/database";

interface AiOpponentBody {
  requesterPlayerId: string;
  enabled: boolean;
  difficulty?: AIDifficulty;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json()) as AiOpponentBody;

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (room.status !== "lobby") {
    return NextResponse.json({ error: "Can't change the AI opponent after the game has started." }, { status: 409 });
  }

  const requester = await db.query.room_players.findFirst({
    where: and(eq(room_players.id, body.requesterPlayerId), eq(room_players.room_id, room.id)),
  });
  if (!requester?.is_host) {
    return NextResponse.json({ error: "Only the host can add an AI opponent." }, { status: 403 });
  }

  const settings = room.settings as RoomSettings;
  const existingBot = await db.query.room_players.findFirst({
    where: and(eq(room_players.room_id, room.id), eq(room_players.guest_id, AI_BOT_GUEST_ID)),
  });

  if (body.enabled) {
    const [bot] = existingBot
      ? await db
          .update(room_players)
          .set({ connection_status: "connected" })
          .where(eq(room_players.id, existingBot.id))
          .returning()
      : await db
          .insert(room_players)
          .values({
            room_id: room.id,
            guest_id: AI_BOT_GUEST_ID,
            display_name: AI_BOT_DISPLAY_NAME,
            avatar_emoji: AI_BOT_AVATAR,
            connection_status: "connected",
          })
          .returning();

    const [updatedRoom] = await db
      .update(rooms)
      .set({ settings: { ...settings, aiDifficulty: body.difficulty ?? settings.aiDifficulty ?? "medium" } })
      .where(eq(rooms.id, room.id))
      .returning();

    if (bot) await publish(roomChannel(room.id), "player_upsert", bot);
    if (updatedRoom) await publish(roomChannel(room.id), "room_update", updatedRoom);
    return NextResponse.json({ player: bot });
  }

  if (existingBot) {
    const [removed] = await db
      .update(room_players)
      .set({ connection_status: "kicked" })
      .where(eq(room_players.id, existingBot.id))
      .returning();
    if (removed) await publish(roomChannel(room.id), "player_upsert", removed);
  }
  return NextResponse.json({ success: true });
}
