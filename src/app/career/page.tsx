"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/lib/hooks/use-identity";
import { api } from "@/lib/api-client";
import { CAREER_OPPONENTS, CAREER_TOTAL_OPPONENTS } from "@/lib/game/career";
import { GENRE_LABELS, GENRE_KEYS, type GenreKey } from "@/lib/game/genres";
import { LogoFull } from "@/components/branding/logo";
import { NavAuthLinks } from "@/components/home/nav-auth-links";
import { Button } from "@/components/ui/button";
import { SplashScreen } from "@/components/branding/splash-screen";
import { ArrowLeft, Check, Lock, Swords } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_ROOM_SETTINGS } from "@/types/database";

export default function CareerModePage() {
  const identity = useIdentity();
  const router = useRouter();
  const [startingLevel, setStartingLevel] = useState<number | null>(null);
  const [genre, setGenre] = useState<GenreKey | "any">("any");

  const careerLevel = identity.profile?.career_level ?? 0;

  async function handleBattle(level: number) {
    if (!identity.profileId) return;
    const opponent = CAREER_OPPONENTS[level - 1]!;
    setStartingLevel(level);
    try {
      const { playlists } = await api.listPlaylists(genre !== "any" ? { genre } : undefined);
      let playlistId = playlists[0]?.id;
      if (!playlistId && genre !== "any") {
        // Fall back to any playlist rather than blocking the battle over a genre that has no tagged playlists yet.
        const { playlists: anyPlaylists } = await api.listPlaylists();
        playlistId = anyPlaylists[0]?.id;
      }
      if (!playlistId) {
        toast.error("No playlists available yet — import one from the home page first.");
        return;
      }

      const { room, player } = await api.createRoom({
        hostDisplayName: identity.displayName,
        hostAvatarEmoji: identity.avatarEmoji,
        hostProfileId: identity.profileId,
        roomName: `Career vs ${opponent.name}`,
        playlistId,
        settings: {
          ...DEFAULT_ROOM_SETTINGS,
          songCount: 10,
          categories: ["title", "artist"],
          aiDifficulty: opponent.difficulty,
          careerLevel: level,
        },
      });

      await api.setAiOpponent(room.code, {
        requesterPlayerId: player.id,
        enabled: true,
        difficulty: opponent.difficulty,
      });

      await api.startGame(room.code, player.id);
      router.push(`/room/${room.code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start the battle.");
    } finally {
      setStartingLevel(null);
    }
  }

  if (identity.loading) return <SplashScreen label="Loading Career Mode..." />;

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" render={<Link href="/" />}>
          <ArrowLeft className="size-4" /> Home
        </Button>
        <LogoFull size={24} />
        <NavAuthLinks />
      </div>

      <div className="text-center flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">🤖 Career Mode</h1>
        <p className="text-muted-foreground">
          Train solo against 20 AI opponents, one at a time — beat the current one to unlock the next.
        </p>
      </div>

      {!identity.isAuthed ? (
        <div className="glass-strong rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">
            Career progress is saved to your account, so sign in first to start climbing the ladder.
          </p>
          <Button render={<Link href="/sign-in" />}>Sign in</Button>
        </div>
      ) : (
        <>
          <div className="glass rounded-xl px-4 py-3 text-center text-sm text-muted-foreground">
            {careerLevel}/{CAREER_TOTAL_OPPONENTS} opponents defeated
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Genre</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGenre("any")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs border transition",
                  genre === "any" ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-muted-foreground"
                )}
              >
                Any genre
              </button>
              {GENRE_KEYS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(g)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs border transition",
                    genre === g ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-muted-foreground"
                  )}
                >
                  {GENRE_LABELS[g]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {CAREER_OPPONENTS.map((opponent) => {
              const isDefeated = opponent.level <= careerLevel;
              const isCurrent = opponent.level === careerLevel + 1;
              const isLocked = !isDefeated && !isCurrent;

              return (
                <div
                  key={opponent.level}
                  className={cn(
                    "glass rounded-xl p-3 flex items-center gap-3",
                    isCurrent && "border border-primary neon-ring",
                    isLocked && "opacity-40"
                  )}
                >
                  <div className="text-2xl w-8 text-center text-muted-foreground text-sm font-mono">
                    {opponent.level}
                  </div>
                  <div className="text-2xl">{opponent.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{opponent.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{opponent.difficulty}</div>
                  </div>
                  {isDefeated && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <Check className="size-3.5" /> Defeated
                    </span>
                  )}
                  {isCurrent && (
                    <Button
                      size="sm"
                      onClick={() => handleBattle(opponent.level)}
                      disabled={startingLevel !== null}
                    >
                      <Swords className="size-3.5" />
                      {startingLevel === opponent.level ? "Starting..." : "Battle"}
                    </Button>
                  )}
                  {isLocked && <Lock className="size-4 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
