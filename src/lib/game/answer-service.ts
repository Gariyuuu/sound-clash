import "server-only";
import { eq, and, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { game_rounds, games, songs, round_locks, room_players, round_answers } from "@/lib/db/schema";
import { fuzzyMatch } from "@/lib/scoring/fuzzy-match";
import { computeIncorrectPenalty, computeScore } from "@/lib/scoring/engine";
import { SCORE_VALUES } from "@/lib/game/types";
import type { ChaosRuleKey } from "@/lib/game/types";
import { buildRevealPayload } from "@/lib/game/round-payload";
import { eliminatesOnWrongAnswer } from "@/lib/game/rules";
import { publish, gameChannel, roomChannel } from "@/lib/ably/publish";
import { aiAccuracyFor } from "@/lib/game/ai-bot";
import type { AIDifficulty, AnswerCategory, RoomSettings, SongRow } from "@/types/database";

export function songFieldFor(
  category: AnswerCategory,
  song: Pick<SongRow, "title" | "artist" | "featured_artist" | "album" | "chorus_lyrics">
) {
  switch (category) {
    case "title": return song.title;
    case "artist": return song.artist;
    case "featured_artist": return song.featured_artist ?? "";
    case "album": return song.album ?? "";
    case "chorus": return song.chorus_lyrics ?? "";
  }
}

/**
 * Simulates the AI opponent "knowing" each required category independently,
 * using the real song row — safe here since this only ever runs server-side,
 * after the bot has already won the buzz lock, exactly like a human would
 * need to buzz before answering. Categories it "doesn't know" are simply
 * omitted, the same shape as a human leaving a field blank.
 */
export function rollAIAnswers(
  categories: AnswerCategory[],
  song: Pick<SongRow, "title" | "artist" | "featured_artist" | "album" | "chorus_lyrics">,
  difficulty: AIDifficulty
): Partial<Record<AnswerCategory, string>> {
  const accuracy = aiAccuracyFor(difficulty);
  const answers: Partial<Record<AnswerCategory, string>> = {};
  for (const category of categories) {
    if (Math.random() < accuracy) {
      const value = songFieldFor(category, song);
      if (value) answers[category] = value;
    }
  }
  return answers;
}

export interface ResolveAnswerParams {
  roundId: string;
  playerId: string;
  answers: Partial<Record<AnswerCategory, string>>;
  usedHint: boolean;
}

export interface ResolveAnswerResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * The single implementation behind both a human's `POST
 * /api/rounds/[roundId]/answer` submission and the AI opponent's simulated
 * turn (`POST /api/rounds/[roundId]/ai-turn`) — extracted so the AI bot
 * reuses the exact same scoring/steal/team-battle logic instead of a
 * parallel reimplementation that could silently drift from it. The AI route
 * calls this with `answers` built from a difficulty-based accuracy roll
 * against the real song fields (server-side, so no answer-secrecy concern)
 * rather than user-typed text needing `fuzzyMatch`.
 */
export async function resolveRoundAnswer(params: ResolveAnswerParams): Promise<ResolveAnswerResult> {
  const { roundId, playerId, answers, usedHint } = params;

  const round = await db.query.game_rounds.findFirst({ where: eq(game_rounds.id, roundId) });
  if (!round) return { status: 404, body: { error: "Round not found." } };
  if (round.status !== "playing" && round.status !== "steal") {
    return { status: 409, body: { error: "Round already resolved." } };
  }

  const lock = await db.query.round_locks.findFirst({
    where: and(eq(round_locks.round_id, roundId), eq(round_locks.phase, round.current_phase)),
  });

  if (!lock || lock.player_id !== playerId) {
    return { status: 403, body: { error: "You don't hold the buzzer." } };
  }

  const game = await db.query.games.findFirst({ where: eq(games.id, round.game_id) });
  const song = await db.query.songs.findFirst({ where: eq(songs.id, round.song_id) });
  if (!game || !song) return { status: 500, body: { error: "Round data missing." } };

  const settings = game.settings as RoomSettings;
  const categories = (round.broadcast_payload as { categories?: AnswerCategory[] } | null)?.categories ?? settings.categories;
  const isSteal = round.current_phase > 1;

  const correctCategories: AnswerCategory[] = [];
  let anyCorrect = false;
  let allCorrect = categories.length > 0;

  for (const category of categories) {
    const guess = answers[category]?.trim() ?? "";
    const correct = guess ? fuzzyMatch(guess, songFieldFor(category, song)) : false;
    if (guess) {
      await db.insert(round_answers).values({
        round_id: roundId,
        game_id: game.id,
        player_id: playerId,
        phase: round.current_phase,
        category,
        guess,
        correct,
        points: correct ? SCORE_VALUES[category] : 0,
      });
    }
    if (correct) {
      anyCorrect = true;
      correctCategories.push(category);
    } else {
      allCorrect = false;
    }
  }

  if (anyCorrect) {
    // Single scoring implementation shared with any future preview UI — see
    // DECISIONS.md D-007 (this used to be reimplemented inline here, which
    // silently skipped Chaos Mode's point modifiers).
    const { total, breakdown } = computeScore({
      correctCategories,
      isSteal,
      isFirstAttemptOfRound: !isSteal,
      buzzRankThisRound: isSteal ? 2 : 1,
      usedHint,
      allCategoriesCorrectThisTurn: allCorrect,
      chaosRule: (round.chaos_rule as ChaosRuleKey | null) ?? null,
    });

    const player = await db.query.room_players.findFirst({ where: eq(room_players.id, playerId) });
    const newScore = (player?.score ?? 0) + total;
    const [updatedPlayer] = await db
      .update(room_players)
      .set({ score: newScore, streak: (player?.streak ?? 0) + 1 })
      .where(eq(room_players.id, playerId))
      .returning();

    // Team Battle: points are shared with the rest of the answerer's team.
    // Penalties for a wrong steal attempt stay individual (see the
    // incorrect-answer branch below) — only positive team scoring is
    // pooled, so one teammate's miss doesn't punish the whole team.
    if (settings.mode === "team_battle" && player?.team) {
      const teammates = await db.query.room_players.findMany({
        where: and(
          eq(room_players.room_id, game.room_id),
          eq(room_players.team, player.team),
          ne(room_players.id, playerId)
        ),
      });
      for (const teammate of teammates) {
        const [updatedTeammate] = await db
          .update(room_players)
          .set({ score: teammate.score + total })
          .where(eq(room_players.id, teammate.id))
          .returning();
        if (updatedTeammate) {
          await publish(gameChannel(game.id), "answer_insert", updatedTeammate);
          await publish(roomChannel(game.room_id), "player_upsert", updatedTeammate);
        }
      }
    }

    const [updatedRound] = await db
      .update(game_rounds)
      .set({
        status: "resolved",
        ended_at: new Date().toISOString(),
        reveal_payload: buildRevealPayload(song),
      })
      .where(eq(game_rounds.id, roundId))
      .returning();

    const allPlayers = await db.query.room_players.findMany({ where: eq(room_players.room_id, game.room_id) });
    const scoreboard = allPlayers.map((p) => ({ playerId: p.id, score: p.score }));

    if (updatedPlayer) {
      await publish(gameChannel(game.id), "answer_insert", updatedPlayer);
      await publish(roomChannel(game.room_id), "player_upsert", updatedPlayer);
    }
    if (updatedRound) await publish(gameChannel(game.id), "round_update", updatedRound);

    return { status: 200, body: { correct: true, total, breakdown, scoreboard } };
  }

  // Incorrect — reset the guesser's streak on this one
  const [resetPlayer] = await db
    .update(room_players)
    .set({ streak: 0 })
    .where(eq(room_players.id, playerId))
    .returning();
  if (resetPlayer) {
    await publish(gameChannel(game.id), "answer_insert", resetPlayer);
    await publish(roomChannel(game.room_id), "player_upsert", resetPlayer);
  }

  const stealPenalty = settings.stealEnabled ? settings.stealPenalty : 0;
  const penalty = computeIncorrectPenalty(isSteal, stealPenalty);
  if (penalty !== 0) {
    const player = await db.query.room_players.findFirst({ where: eq(room_players.id, playerId) });
    const [penalized] = await db
      .update(room_players)
      .set({ score: Math.max(0, (player?.score ?? 0) + penalty) })
      .where(eq(room_players.id, playerId))
      .returning();
    if (penalized) {
      await publish(gameChannel(game.id), "answer_insert", penalized);
      await publish(roomChannel(game.room_id), "player_upsert", penalized);
    }
  }

  if (eliminatesOnWrongAnswer(settings)) {
    const [eliminated] = await db
      .update(room_players)
      .set({ is_spectator: true })
      .where(eq(room_players.id, playerId))
      .returning();
    if (eliminated) {
      await publish(gameChannel(game.id), "answer_insert", eliminated);
      await publish(roomChannel(game.room_id), "player_upsert", eliminated);
    }
  }

  const nextExcluded = [...round.excluded_player_ids, playerId];

  const [{ count: eligibleCount }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(room_players)
    .where(
      and(
        eq(room_players.room_id, game.room_id),
        eq(room_players.is_spectator, false),
        eq(room_players.connection_status, "connected"),
        notInArray(room_players.id, nextExcluded)
      )
    );

  if (!eligibleCount) {
    const [updatedRound] = await db
      .update(game_rounds)
      .set({
        status: "resolved",
        ended_at: new Date().toISOString(),
        excluded_player_ids: nextExcluded,
        reveal_payload: buildRevealPayload(song),
      })
      .where(eq(game_rounds.id, roundId))
      .returning();
    if (updatedRound) await publish(gameChannel(game.id), "round_update", updatedRound);

    return { status: 200, body: { correct: false, penalty, roundOver: true, reveal: buildRevealPayload(song) } };
  }

  const [updatedRound] = await db
    .update(game_rounds)
    .set({
      status: "steal",
      current_phase: round.current_phase + 1,
      phase_started_at: new Date().toISOString(),
      excluded_player_ids: nextExcluded,
    })
    .where(eq(game_rounds.id, roundId))
    .returning();
  if (updatedRound) await publish(gameChannel(game.id), "round_update", updatedRound);

  return { status: 200, body: { correct: false, penalty, roundOver: false, nextPhase: round.current_phase + 1 } };
}
