import { NextResponse } from "next/server";
import { desc, asc, isNotNull } from "drizzle-orm";
import { db, safeQuery } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

const SORTABLE_COLUMNS = {
  xp: profiles.xp,
  total_points: profiles.total_points,
  wins: profiles.wins,
  fastest_buzz: profiles.fastest_buzz_ms,
  steals: profiles.total_steals,
  streak: profiles.longest_streak,
} as const;

type LeaderboardType = keyof typeof SORTABLE_COLUMNS;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type") ?? "xp";
  const type: LeaderboardType = typeParam in SORTABLE_COLUMNS ? (typeParam as LeaderboardType) : "xp";
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 25));

  const column = SORTABLE_COLUMNS[type];

  const selectFields = {
    id: profiles.id,
    username: profiles.username,
    avatar_emoji: profiles.avatar_emoji,
    title: profiles.title,
    level: profiles.level,
    xp: profiles.xp,
    total_points: profiles.total_points,
    wins: profiles.wins,
    games_played: profiles.games_played,
    fastest_buzz_ms: profiles.fastest_buzz_ms,
    total_steals: profiles.total_steals,
    longest_streak: profiles.longest_streak,
  };

  // Fastest buzz is "lower is better," and nulls (never buzzed) must be excluded
  // rather than sorted first — everything else is a standard descending sort.
  const entries = await safeQuery(
    () =>
      type === "fastest_buzz"
        ? db
            .select(selectFields)
            .from(profiles)
            .where(isNotNull(profiles.fastest_buzz_ms))
            .orderBy(asc(profiles.fastest_buzz_ms))
            .limit(limit)
        : db.select(selectFields).from(profiles).orderBy(desc(column)).limit(limit),
    []
  );

  return NextResponse.json({ type, entries });
}
