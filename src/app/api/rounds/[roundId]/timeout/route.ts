import { NextResponse } from "next/server";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { game_rounds, games, room_players, songs, round_locks } from "@/lib/db/schema";
import { buildRevealPayload } from "@/lib/game/round-payload";
import { computeIncorrectPenalty } from "@/lib/scoring/engine";
import { publish, gameChannel } from "@/lib/ably/publish";
import type { RoomSettings } from "@/types/database";

// Called by the host's client, which is the round's timing authority on this
// serverless deployment (see src/lib/game/types.ts header comment). Covers
// two cases: nobody buzzed in time ("no_buzz"), or the buzz holder didn't
// submit an answer within their window ("no_answer" — treated as a miss).
interface TimeoutBody {
  requesterPlayerId: string;
  reason: "no_buzz" | "no_answer";
}

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const { requesterPlayerId, reason } = (await request.json()) as TimeoutBody;

  const round = await db.query.game_rounds.findFirst({ where: eq(game_rounds.id, roundId) });
  if (!round) return NextResponse.json({ error: "Round not found." }, { status: 404 });
  if (round.status !== "playing" && round.status !== "steal") {
    return NextResponse.json({ resolved: true });
  }

  const game = await db.query.games.findFirst({ where: eq(games.id, round.game_id) });
  if (!game) return NextResponse.json({ error: "Game missing." }, { status: 500 });

  const requester = await db.query.room_players.findFirst({
    where: and(eq(room_players.id, requesterPlayerId), eq(room_players.room_id, game.room_id)),
  });
  if (!requester?.is_host) return NextResponse.json({ error: "Only the host can advance the round." }, { status: 403 });

  const song = await db.query.songs.findFirst({ where: eq(songs.id, round.song_id) });
  if (!song) return NextResponse.json({ error: "Song missing." }, { status: 500 });

  if (reason === "no_answer") {
    const lock = await db.query.round_locks.findFirst({
      where: and(eq(round_locks.round_id, roundId), eq(round_locks.phase, round.current_phase)),
    });

    if (lock) {
      const settings = game.settings as RoomSettings;
      const isSteal = round.current_phase > 1;
      const penalty = computeIncorrectPenalty(isSteal, settings.stealEnabled ? settings.stealPenalty : 0);
      if (penalty !== 0) {
        const player = await db.query.room_players.findFirst({ where: eq(room_players.id, lock.player_id) });
        await db
          .update(room_players)
          .set({ score: Math.max(0, (player?.score ?? 0) + penalty) })
          .where(eq(room_players.id, lock.player_id));
      }

      const nextExcluded = [...round.excluded_player_ids, lock.player_id];
      const [{ count: eligibleCount }] = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(room_players)
        .where(
          and(
            eq(room_players.room_id, game.room_id),
            eq(room_players.is_spectator, false),
            eq(room_players.connection_status, "connected"),
            nextExcluded.length ? notInArray(room_players.id, nextExcluded) : undefined
          )
        );

      if (eligibleCount) {
        const [updated] = await db
          .update(game_rounds)
          .set({
            status: "steal",
            current_phase: round.current_phase + 1,
            phase_started_at: new Date().toISOString(),
            excluded_player_ids: nextExcluded,
          })
          .where(eq(game_rounds.id, roundId))
          .returning();
        if (updated) await publish(gameChannel(game.id), "round_update", updated);
        return NextResponse.json({ resolved: false, nextPhase: round.current_phase + 1 });
      }
    }
  }

  const [updated] = await db
    .update(game_rounds)
    .set({ status: "resolved", ended_at: new Date().toISOString(), reveal_payload: buildRevealPayload(song) })
    .where(eq(game_rounds.id, roundId))
    .returning();
  if (updated) await publish(gameChannel(game.id), "round_update", updated);

  return NextResponse.json({ resolved: true, reveal: buildRevealPayload(song) });
}
