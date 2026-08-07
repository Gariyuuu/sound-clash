import { eq, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { room_players, game_rounds, round_answers, round_locks, match_history, games, rooms, profiles, songs } from "@/lib/db/schema";
import type { GameRow, MatchHistoryPlayerSnapshot, MatchHistoryTimelineEvent, RoomSettings } from "@/types/database";
import { xpForGame, levelForXp } from "@/lib/scoring/engine";
import { checkAndUnlockAchievements } from "@/lib/game/achievements";
import { publish, gameChannel, roomChannel } from "@/lib/ably/publish";

const PERFECT_EAR_THRESHOLD_MS = 1000;

export async function finishGame(game: GameRow) {
  const players = await db.query.room_players.findMany({ where: eq(room_players.room_id, game.room_id) });

  const rounds = await db
    .select({
      id: game_rounds.id,
      round_number: game_rounds.round_number,
      started_at: game_rounds.started_at,
      song_title: songs.title,
      song_artist: songs.artist,
    })
    .from(game_rounds)
    .leftJoin(songs, eq(game_rounds.song_id, songs.id))
    .where(eq(game_rounds.game_id, game.id))
    .orderBy(asc(game_rounds.round_number));

  const roundIds = rounds.map((r) => r.id);
  const answers = roundIds.length ? await db.query.round_answers.findMany({ where: inArray(round_answers.round_id, roundIds) }) : [];
  const locks = roundIds.length ? await db.query.round_locks.findMany({ where: inArray(round_locks.round_id, roundIds) }) : [];

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const careerLevel = (game.settings as RoomSettings).careerLevel;

  const roundStartedAt = new Map(rounds.map((r) => [r.id, new Date(r.started_at).getTime()]));
  const lockLookup = new Map(locks.map((l) => [`${l.round_id}:${l.phase}`, l]));

  const perPlayerCorrect = new Map<string, number>();
  const perPlayerTotal = new Map<string, number>();
  const perPlayerSteals = new Map<string, number>();
  const perPlayerAlbumsCorrect = new Map<string, number>();
  const perPlayerFastestBuzzWins = new Map<string, number>();
  const perPlayerFastestBuzzMs = new Map<string, number>();
  const perPlayerPerfectEar = new Set<string>();

  for (const a of answers) {
    perPlayerTotal.set(a.player_id, (perPlayerTotal.get(a.player_id) ?? 0) + 1);
    if (a.correct) {
      perPlayerCorrect.set(a.player_id, (perPlayerCorrect.get(a.player_id) ?? 0) + 1);
      if (a.phase > 1) perPlayerSteals.set(a.player_id, (perPlayerSteals.get(a.player_id) ?? 0) + 1);
      if (a.category === "album") perPlayerAlbumsCorrect.set(a.player_id, (perPlayerAlbumsCorrect.get(a.player_id) ?? 0) + 1);
      if (a.phase === 1) perPlayerFastestBuzzWins.set(a.player_id, (perPlayerFastestBuzzWins.get(a.player_id) ?? 0) + 1);

      const lock = lockLookup.get(`${a.round_id}:${a.phase}`);
      const roundStart = roundStartedAt.get(a.round_id);
      if (lock && roundStart !== undefined) {
        const buzzMs = new Date(lock.buzzed_at).getTime() - roundStart;
        const answerMs = new Date(a.answered_at).getTime() - new Date(lock.buzzed_at).getTime();
        if (buzzMs >= 0) {
          perPlayerFastestBuzzMs.set(a.player_id, Math.min(perPlayerFastestBuzzMs.get(a.player_id) ?? Infinity, buzzMs));
        }
        if (answerMs >= 0 && answerMs <= PERFECT_EAR_THRESHOLD_MS) {
          perPlayerPerfectEar.add(a.player_id);
        }
      }
    }
  }

  const snapshots: MatchHistoryPlayerSnapshot[] = sorted.map((p, i) => {
    const total = perPlayerTotal.get(p.id) ?? 0;
    const correct = perPlayerCorrect.get(p.id) ?? 0;
    const fastest = perPlayerFastestBuzzMs.get(p.id);
    return {
      playerId: p.id,
      profileId: p.profile_id,
      displayName: p.display_name,
      avatarEmoji: p.avatar_emoji,
      finalScore: p.score,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      steals: perPlayerSteals.get(p.id) ?? 0,
      fastestBuzzMs: fastest !== undefined && Number.isFinite(fastest) ? Math.round(fastest) : null,
      placement: i + 1,
    };
  });

  const timeline: MatchHistoryTimelineEvent[] = rounds.map((r) => {
    const roundAnswers = answers.filter((a) => a.round_id === r.id);
    const winningAnswer = roundAnswers.find((a) => a.correct);
    return {
      roundNumber: r.round_number,
      songTitle: r.song_title ?? "Unknown",
      songArtist: r.song_artist ?? "Unknown",
      buzzWinner: winningAnswer?.player_id ?? null,
      correct: roundAnswers.length ? Boolean(winningAnswer) : null,
      pointsAwarded: winningAnswer?.points ?? 0,
      wasSteal: (winningAnswer?.phase ?? 1) > 1,
    };
  });

  const startedAt = new Date(game.started_at).getTime();
  const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

  const [matchHistory] = await db
    .insert(match_history)
    .values({
      game_id: game.id,
      room_id: game.room_id,
      mode: game.mode,
      players: snapshots,
      winner_profile_id: winner?.profile_id ?? null,
      round_count: rounds.length,
      duration_seconds: durationSeconds,
      timeline,
    })
    .returning();

  const [finishedGame] = await db
    .update(games)
    .set({ status: "finished", ended_at: new Date().toISOString() })
    .where(eq(games.id, game.id))
    .returning();
  const [finishedRoom] = await db
    .update(rooms)
    .set({ status: "finished" })
    .where(eq(rooms.id, game.room_id))
    .returning();

  if (finishedGame) await publish(gameChannel(game.id), "game_update", finishedGame);
  // "room_update" is what drives RoomClient's lobby/playing/finished view switch.
  if (finishedRoom) await publish(roomChannel(game.room_id), "room_update", finishedRoom);

  for (const snap of snapshots) {
    if (!snap.profileId) continue;
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, snap.profileId) });
    if (!profile) continue;

    const player = sorted.find((p) => p.id === snap.playerId);
    const won = snap.placement === 1;
    const perfectGame = snap.accuracy === 100 && (perPlayerTotal.get(snap.playerId) ?? 0) > 0;
    const xpGained = xpForGame({ won, correctAnswers: perPlayerCorrect.get(snap.playerId) ?? 0, perfectGame });
    const newXp = profile.xp + xpGained;
    const newFastestBuzz =
      snap.fastestBuzzMs !== null
        ? Math.min(profile.fastest_buzz_ms ?? Infinity, snap.fastestBuzzMs)
        : profile.fastest_buzz_ms;

    const [updated] = await db
      .update(profiles)
      .set({
        xp: newXp,
        level: levelForXp(newXp),
        games_played: profile.games_played + 1,
        wins: profile.wins + (won ? 1 : 0),
        total_points: profile.total_points + snap.finalScore,
        songs_guessed: profile.songs_guessed + (perPlayerCorrect.get(snap.playerId) ?? 0),
        correct_answers: profile.correct_answers + (perPlayerCorrect.get(snap.playerId) ?? 0),
        total_answers: profile.total_answers + (perPlayerTotal.get(snap.playerId) ?? 0),
        total_steals: profile.total_steals + snap.steals,
        albums_correct: profile.albums_correct + (perPlayerAlbumsCorrect.get(snap.playerId) ?? 0),
        fastest_buzz_wins: profile.fastest_buzz_wins + (perPlayerFastestBuzzWins.get(snap.playerId) ?? 0),
        fastest_buzz_ms: Number.isFinite(newFastestBuzz as number) ? newFastestBuzz : null,
        game_win_streak: won ? profile.game_win_streak + 1 : 0,
        longest_streak: Math.max(profile.longest_streak, player?.streak ?? 0),
        // Career Mode: beating the current (or a replayed earlier) opponent
        // advances the ladder, capped so a replay of an earlier level can
        // never regress progress already made.
        career_level: careerLevel && won ? Math.max(profile.career_level, careerLevel) : profile.career_level,
        updated_at: new Date().toISOString(),
      })
      .where(eq(profiles.id, snap.profileId))
      .returning();

    if (updated) {
      await checkAndUnlockAchievements(snap.profileId, updated, {
        hadPerfectEarThisGame: perPlayerPerfectEar.has(snap.playerId),
      });
    }
  }

  return matchHistory;
}
