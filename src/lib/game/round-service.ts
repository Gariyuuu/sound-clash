import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { songs, game_rounds } from "@/lib/db/schema";
import type { GameRow, RoomSettings } from "@/types/database";
import { buildBroadcastPayload } from "@/lib/game/round-payload";
import { resolveCategories, resolveTimerSeconds, rollChaosRule } from "@/lib/game/rules";
import { publish, gameChannel } from "@/lib/ably/publish";

export async function createRoundForGame(game: GameRow, roundNumber: number) {
  const songId = game.song_order[roundNumber - 1];
  if (!songId) return null;

  const song = await db.query.songs.findFirst({ where: eq(songs.id, songId) });
  if (!song) return null;

  const settings = game.settings as RoomSettings;
  const timerSeconds = resolveTimerSeconds(settings);
  const categories = { ...settings, categories: resolveCategories(settings) };
  const chaosRule = rollChaosRule(settings.mode);

  const [round] = await db
    .insert(game_rounds)
    .values({
      game_id: game.id,
      song_id: song.id,
      round_number: roundNumber,
      chaos_rule: chaosRule,
      status: "playing",
      current_phase: 1,
    })
    .returning();

  if (!round) return null;

  const broadcastPayload = buildBroadcastPayload({
    roundId: round.id,
    roundNumber,
    totalRounds: game.song_order.length,
    song,
    settings: categories,
    timerSeconds,
  });

  const [updated] = await db
    .update(game_rounds)
    .set({ broadcast_payload: broadcastPayload })
    .where(eq(game_rounds.id, round.id))
    .returning();

  const finalRound = updated ?? round;

  // "round_insert" tells every subscribed client (including the one that
  // triggered this) a new round has started — see use-game-realtime.ts.
  await publish(gameChannel(game.id), "round_insert", finalRound);

  return { round: finalRound, song, broadcastPayload };
}
