"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIdentity } from "@/lib/hooks/use-identity";
import { api } from "@/lib/api-client";
import { levelForXp } from "@/lib/scoring/engine";
import { LogoFull } from "@/components/branding/logo";
import { NavAuthLinks } from "@/components/home/nav-auth-links";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SplashScreen } from "@/components/branding/splash-screen";
import { ArrowLeft, Flame, Target, Trophy, Zap } from "lucide-react";
import type { AchievementRow, ProfileRow } from "@/types/database";
import { cn } from "@/lib/utils";

const ALL_ACHIEVEMENT_KEYS = [
  ["perfect_ear", "Perfect Ear", "👂"],
  ["album_master", "Album Master", "💿"],
  ["speed_demon", "Speed Demon", "⚡"],
  ["steal_king", "Steal King", "🕵️"],
  ["unstoppable", "Unstoppable", "🔥"],
  ["century", "100 Games Played", "💯"],
  ["thousand_songs", "1000 Songs Guessed", "🎼"],
  ["collector", "Collector", "📦"],
  ["music_encyclopedia", "Music Encyclopedia", "📚"],
] as const;

function xpProgress(xp: number) {
  let remaining = xp;
  let requirement = 250;
  while (remaining >= requirement) {
    remaining -= requirement;
    requirement += 250;
  }
  return { into: remaining, needed: requirement, pct: Math.round((remaining / requirement) * 100) };
}

export default function ProfilePage() {
  const identity = useIdentity();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (identity.loading) return;
    if (!identity.isAuthed || !identity.profile) {
      setLoading(false);
      return;
    }
    api
      .getProfile(identity.profile.username)
      .then(({ profile, achievements }) => {
        setProfile(profile);
        setUnlocked(new Set(achievements.map((a: AchievementRow) => a.key)));
      })
      .finally(() => setLoading(false));
  }, [identity.loading, identity.isAuthed, identity.profile]);

  if (identity.loading || loading) return <SplashScreen label="Loading profile..." />;

  if (!identity.isAuthed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">No profile yet</h1>
        <p className="text-muted-foreground">Create an account to track XP, stats, and achievements.</p>
        <Button render={<Link href="/sign-up" />}>Create an account</Button>
      </div>
    );
  }

  if (!profile) return null;

  const progress = xpProgress(profile.xp);
  const accuracy = profile.total_answers > 0 ? Math.round((profile.correct_answers / profile.total_answers) * 100) : 0;

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" render={<Link href="/" />}>
          <ArrowLeft className="size-4" /> Home
        </Button>
        <LogoFull size={24} />
        <NavAuthLinks />
      </div>

      <div className="glass-strong rounded-3xl p-8 flex flex-col items-center gap-3 text-center">
        <div className="text-6xl">{profile.avatar_emoji}</div>
        <h1 className="text-2xl font-extrabold">{profile.username}</h1>
        <p className="text-muted-foreground">{profile.title} · Level {levelForXp(profile.xp)}</p>
        <div className="w-full max-w-sm flex flex-col gap-1.5 mt-2">
          <Progress value={progress.pct} />
          <p className="text-xs text-muted-foreground">{progress.into} / {progress.needed} XP to next level</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Trophy, label: "Wins", value: profile.wins },
          { icon: Zap, label: "Games Played", value: profile.games_played },
          { icon: Target, label: "Accuracy", value: `${accuracy}%` },
          { icon: Flame, label: "Longest Streak", value: profile.longest_streak },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl p-4 flex flex-col items-center gap-1 text-center">
            <s.icon className="size-5 text-emerald-400" />
            <span className="text-xl font-bold">{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Achievements</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {ALL_ACHIEVEMENT_KEYS.map(([key, name, icon]) => {
            const isUnlocked = unlocked.has(key);
            return (
              <div
                key={key}
                className={cn(
                  "glass rounded-2xl p-3 flex flex-col items-center gap-1 text-center",
                  !isUnlocked && "opacity-30 grayscale"
                )}
                title={name}
              >
                <span className="text-2xl">{icon}</span>
                <span className="text-[11px] leading-tight">{name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
