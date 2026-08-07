import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profile_achievements } from "@/lib/db/schema";
import type { ProfileRow } from "@/types/database";
import { levelForXp } from "@/lib/scoring/engine";

interface AchievementContext {
  hadPerfectEarThisGame: boolean;
}

const THRESHOLDS: { key: string; check: (p: ProfileRow, ctx: AchievementContext) => boolean }[] = [
  { key: "perfect_ear", check: (_p, ctx) => ctx.hadPerfectEarThisGame },
  { key: "album_master", check: (p) => p.albums_correct >= 50 },
  { key: "speed_demon", check: (p) => p.fastest_buzz_wins >= 25 },
  { key: "steal_king", check: (p) => p.total_steals >= 25 },
  { key: "unstoppable", check: (p) => p.game_win_streak >= 10 },
  { key: "century", check: (p) => p.games_played >= 100 },
  { key: "thousand_songs", check: (p) => p.songs_guessed >= 1000 },
  { key: "music_encyclopedia", check: (p) => levelForXp(p.xp) >= 25 },
];

/**
 * Evaluates every non-meta achievement's threshold against a just-updated
 * profile row and unlocks any newly-earned ones (atomic per-key via
 * `onConflictDoNothing`, so re-running this for a profile that already has
 * a given achievement is a safe no-op). Then separately evaluates the
 * "Collector" meta-achievement (unlock 10 others). Returns the keys of
 * achievements newly unlocked by this call, for a future "unlocked!" toast.
 */
export async function checkAndUnlockAchievements(
  profileId: string,
  profile: ProfileRow,
  context: AchievementContext
): Promise<string[]> {
  const newlyUnlocked: string[] = [];

  for (const { key, check } of THRESHOLDS) {
    if (!check(profile, context)) continue;
    const inserted = await db
      .insert(profile_achievements)
      .values({ profile_id: profileId, achievement_key: key })
      .onConflictDoNothing({ target: [profile_achievements.profile_id, profile_achievements.achievement_key] })
      .returning();
    if (inserted.length > 0) newlyUnlocked.push(key);
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(profile_achievements)
    .where(and(eq(profile_achievements.profile_id, profileId), ne(profile_achievements.achievement_key, "collector")));

  if (count >= 10) {
    const inserted = await db
      .insert(profile_achievements)
      .values({ profile_id: profileId, achievement_key: "collector" })
      .onConflictDoNothing({ target: [profile_achievements.profile_id, profile_achievements.achievement_key] })
      .returning();
    if (inserted.length > 0) newlyUnlocked.push("collector");
  }

  return newlyUnlocked;
}
