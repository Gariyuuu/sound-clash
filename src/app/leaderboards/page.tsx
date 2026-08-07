"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { LEADERBOARD_LABELS, type LeaderboardEntry, type LeaderboardType } from "@/lib/game/types";
import { LogoFull } from "@/components/branding/logo";
import { NavAuthLinks } from "@/components/home/nav-auth-links";
import { Button } from "@/components/ui/button";
import { SplashScreen } from "@/components/branding/splash-screen";
import { ArrowLeft, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPES = Object.keys(LEADERBOARD_LABELS) as LeaderboardType[];

function valueFor(entry: LeaderboardEntry, type: LeaderboardType): string {
  switch (type) {
    case "xp": return `${entry.xp} XP`;
    case "total_points": return `${entry.total_points} pts`;
    case "wins": return `${entry.wins} wins`;
    case "fastest_buzz": return entry.fastest_buzz_ms != null ? `${(entry.fastest_buzz_ms / 1000).toFixed(2)}s` : "—";
    case "steals": return `${entry.total_steals} steals`;
    case "streak": return `${entry.longest_streak} streak`;
  }
}

export default function LeaderboardsPage() {
  const [type, setType] = useState<LeaderboardType>("xp");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    api
      .getLeaderboard(type)
      .then(({ entries }) => !cancelled && setEntries(entries))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load."));
    return () => {
      cancelled = true;
    };
  }, [type]);

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" render={<Link href="/" />}>
          <ArrowLeft className="size-4" /> Home
        </Button>
        <LogoFull size={24} />
        <NavAuthLinks />
      </div>

      <h1 className="text-3xl font-extrabold text-center">Leaderboards</h1>

      <div className="flex flex-wrap justify-center gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm border transition",
              type === t ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-muted-foreground"
            )}
          >
            {LEADERBOARD_LABELS[t]}
          </button>
        ))}
      </div>

      {error && <p className="text-center text-destructive">{error}</p>}

      {!entries && !error && <SplashScreen label="Loading leaderboard..." />}

      {entries && (
        <div className="glass rounded-2xl p-4 flex flex-col gap-1">
          {entries.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No players yet — be the first!</p>
          )}
          {entries.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/5">
              <span className="w-6 text-sm text-muted-foreground text-center">
                {i === 0 ? <Crown className="size-4 text-amber-400 mx-auto" /> : i + 1}
              </span>
              <span className="text-xl">{entry.avatar_emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{entry.username}</div>
                <div className="text-xs text-muted-foreground">{entry.title} · Lvl {entry.level}</div>
              </div>
              <span className="font-semibold tabular-nums">{valueFor(entry, type)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
