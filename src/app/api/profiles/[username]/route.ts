import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles, profile_achievements, achievements } from "@/lib/db/schema";
import type { AchievementRow } from "@/types/database";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const profile = await db.query.profiles.findFirst({ where: eq(profiles.username, username) });
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  // Two queries + in-memory join rather than a relational query — keeps this
  // route's shape identical across the Supabase -> Drizzle migration.
  const unlocked = await db.query.profile_achievements.findMany({ where: eq(profile_achievements.profile_id, profile.id) });

  let unlockedAchievements: (AchievementRow & { unlocked_at: string })[] = [];
  if (unlocked.length > 0) {
    const catalog = await db.query.achievements.findMany({
      where: inArray(achievements.key, unlocked.map((u) => u.achievement_key)),
    });
    const unlockedAtByKey = new Map(unlocked.map((u) => [u.achievement_key, u.unlocked_at]));
    unlockedAchievements = catalog.map((a) => ({ ...a, unlocked_at: unlockedAtByKey.get(a.key)! }));
  }

  return NextResponse.json({ profile, achievements: unlockedAchievements });
}
