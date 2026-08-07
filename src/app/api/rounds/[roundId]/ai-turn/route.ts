import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { game_rounds, games, songs, round_locks, room_players } from "@/lib/db/schema";
import { publish, gameChannel } from "@/lib/ably/publish";
import { resolveRoundAnswer, rollAIAnswers } from "@/lib/game/answer-service";
import { AI_BOT_GUEST_ID } from "@/lib/game/ai-bot";
import type { RevealedHint } from "@/lib/game/types";
import type { AnswerCategory, RoomSettings } from "@/types/database";

interface AiTurnBody {
  requesterPlayerId: string;
}

/**
 * Simulates the AI opponent's buzz-in + answer for the current round/phase.
 * Triggered by the host's client (the existing timing authority — see
 * ARCHITECTURE.md) after a difficulty-scaled random delay computed with
 * `aiBuzzDelayMs()`. A no-op (returns `{ acted: false }`) if a human already
 * buzzed first, the round already resolved, or no AI opponent is in this
 * room — safe to call speculatively without the caller checking state first.
 */
export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const { requesterPlayerId } = (await request.json()) as AiTurnBody;

  const round = await db.query.game_rounds.findFirst({ where: eq(game_rounds.id, roundId) });
  if (!round || (round.status !== "playing" && round.status !== "steal")) {
    return NextResponse.json({ acted: false });
  }

  const game = await db.query.games.findFirst({ where: eq(games.id, round.game_id) });
  if (!game) return NextResponse.json({ error: "Game missing." }, { status: 500 });

  const requester = await db.query.room_players.findFirst({
    where: and(eq(room_players.id, requesterPlayerId), eq(room_players.room_id, game.room_id)),
  });
  if (!requester?.is_host) return NextResponse.json({ error: "Only the host can trigger the AI's turn." }, { status: 403 });

  const bot = await db.query.room_players.findFirst({
    where: and(
      eq(room_players.room_id, game.room_id),
      eq(room_players.guest_id, AI_BOT_GUEST_ID),
      eq(room_players.connection_status, "connected")
    ),
  });
  if (!bot || round.excluded_player_ids.includes(bot.id)) {
    return NextResponse.json({ acted: false });
  }

  const inserted = await db
    .insert(round_locks)
    .values({ round_id: roundId, phase: round.current_phase, player_id: bot.id, client_latency_ms: 0 })
    .onConflictDoNothing({ target: [round_locks.round_id, round_locks.phase] })
    .returning();

  if (inserted.length === 0 || inserted[0]!.player_id !== bot.id) {
    return NextResponse.json({ acted: false });
  }

  await publish(gameChannel(game.id), "lock_insert", inserted[0]);

  const song = await db.query.songs.findFirst({ where: eq(songs.id, round.song_id) });
  if (!song) return NextResponse.json({ error: "Song missing." }, { status: 500 });

  const settings = game.settings as RoomSettings;
  const categories = (round.broadcast_payload as { categories?: AnswerCategory[] } | null)?.categories ?? settings.categories;
  const difficulty = settings.aiDifficulty ?? "medium";
  const answers = rollAIAnswers(categories, song, difficulty);
  const usedHint = ((round.revealed_hints as RevealedHint[] | null) ?? []).length > 0;

  const result = await resolveRoundAnswer({ roundId, playerId: bot.id, answers, usedHint });
  return NextResponse.json({ acted: true, ...result.body }, { status: result.status });
}
