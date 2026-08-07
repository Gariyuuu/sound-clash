"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoFull } from "@/components/branding/logo";
import { AVATAR_EMOJIS } from "@/lib/guest";
import { cn } from "@/lib/utils";
import type { Identity } from "@/lib/hooks/use-identity";

export function NameGate({
  identity,
  error,
  askSpectator,
  onSubmit,
}: {
  identity: Identity;
  error: string | null;
  askSpectator: boolean;
  onSubmit: (asSpectator: boolean) => void;
}) {
  const [name, setName] = useState(identity.displayName || "");
  const [emoji, setEmoji] = useState(identity.avatarEmoji || "🎧");

  function handleSubmit(e: React.FormEvent, asSpectator: boolean) {
    e.preventDefault();
    if (!name.trim()) return;
    identity.setDisplayName(name.trim());
    identity.setAvatarEmoji(emoji);
    onSubmit(asSpectator);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
      <LogoFull size={32} />
      <form onSubmit={(e) => handleSubmit(e, false)} className="glass rounded-3xl p-8 w-full max-w-sm flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold">Ready to clash?</h1>
          <p className="text-sm text-muted-foreground">Pick a name and avatar to join.</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {askSpectator && (
          <p className="text-sm text-amber-400">This game already started — you can join as a spectator.</p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required autoFocus />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Avatar</Label>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn(
                  "aspect-square rounded-xl text-xl flex items-center justify-center border transition",
                  emoji === e ? "border-primary bg-primary/10 neon-ring" : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {askSpectator ? (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={(e) => handleSubmit(e, true)}>
              Join as spectator
            </Button>
          </div>
        ) : (
          <Button type="submit" className="neon-glow-green">
            Join Room
          </Button>
        )}
      </form>
    </div>
  );
}
