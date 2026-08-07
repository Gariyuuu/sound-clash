import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_players, games, game_rounds, songs } from "@/lib/db/schema";
import { buildRevealPayload } from "@/lib/game/round-payload";
import { publish, gameChannel, roomChannel } from "@/lib/ably/publish";
import type { RoomSettings } from "@/types/database";

interface ControlBody {
  requesterPlayerId: string;
  action: "pause" | "resume" | "skip" | "set_timer";
  timerSeconds?: number;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { requesterPlayerId, action, timerSeconds } = (await request.json()) as ControlBody;

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const requester = await db.query.room_players.findFirst({
    where: and(eq(room_players.id, requesterPlayerId), eq(room_players.room_id, room.id)),
  });
  if (!requester?.is_host) return NextResponse.json({ error: "Only the host can control the game." }, { status: 403 });

  const game = await db.query.games.findFirst({
    where: and(eq(games.room_id, room.id), eq(games.status, "active")),
    orderBy: desc(games.started_at),
  });
  if (!game) return NextResponse.json({ error: "No active game." }, { status: 404 });

  if (action === "pause" || action === "resume") {
    const [updated] = await db
      .update(games)
      .set({ paused: action === "pause" })
      .where(eq(games.id, game.id))
      .returning();
    if (updated) await publish(gameChannel(game.id), "game_update", updated);
    return NextResponse.json({ paused: action === "pause" });
  }

  // Live buzz-timer change — doesn't retroactively alter the round already
  // in flight (each round's countdown is baked into its own broadcast
  // payload at creation, see round-service.ts), only the next round created
  // for this game. Also written back to `rooms.settings` so it's still the
  // default if the host returns to the lobby or starts a new game.
  if (action === "set_timer") {
    const clamped = Math.min(30, Math.max(5, Math.round(timerSeconds ?? 20)));
    const gameSettings = { ...(game.settings as RoomSettings), timerSeconds: clamped };
    const [updatedGame] = await db.update(games).set({ settings: gameSettings }).where(eq(games.id, game.id)).returning();
    if (updatedGame) await publish(gameChannel(game.id), "game_update", updatedGame);

    const roomSettings = { ...(room.settings as RoomSettings), timerSeconds: clamped };
    const [updatedRoom] = await db
      .update(rooms)
      .set({ settings: roomSettings, updated_at: new Date().toISOString() })
      .where(eq(rooms.id, room.id))
      .returning();
    if (updatedRoom) await publish(roomChannel(room.id), "room_update", updatedRoom);

    return NextResponse.json({ timerSeconds: clamped });
  }

  // Skip: force-resolve the current live round with no winner, revealing the answer.
  const round = await db.query.game_rounds.findFirst({
    where: eq(game_rounds.game_id, game.id),
    orderBy: desc(game_rounds.round_number),
  });

  if (round && (round.status === "playing" || round.status === "steal")) {
    const song = await db.query.songs.findFirst({ where: eq(songs.id, round.song_id) });
    const [updatedRound] = await db
      .update(game_rounds)
      .set({
        status: "skipped",
        ended_at: new Date().toISOString(),
        reveal_payload: song ? buildRevealPayload(song) : null,
      })
      .where(eq(game_rounds.id, round.id))
      .returning();
    if (updatedRound) await publish(gameChannel(game.id), "round_update", updatedRound);
  }

  return NextResponse.json({ skipped: true });
}
