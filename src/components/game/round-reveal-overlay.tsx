"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { RoundRevealPayload } from "@/lib/game/types";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

export function RoundRevealOverlay({
  reveal,
  roundId,
  isHost,
  selfPlayerId,
}: {
  reveal: RoundRevealPayload;
  roundId: string;
  isHost: boolean;
  selfPlayerId: string;
}) {
  const [advancing, setAdvancing] = useState(false);

  async function handleNext() {
    setAdvancing(true);
    try {
      await api.nextRound(roundId, selfPlayerId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to advance round.");
      setAdvancing(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="glass-strong rounded-3xl p-8 max-w-md w-full flex flex-col items-center gap-4 text-center"
      >
        {reveal.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reveal.coverUrl} alt="" className="size-32 rounded-2xl object-cover neon-glow-violet" />
        )}
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wide">The song was</p>
          <h2 className="text-2xl font-extrabold">{reveal.title}</h2>
          <p className="text-lg text-muted-foreground">
            {reveal.artist}
            {reveal.featuredArtist ? ` ft. ${reveal.featuredArtist}` : ""}
          </p>
          {(reveal.album || reveal.year) && (
            <p className="text-sm text-muted-foreground mt-1">
              {reveal.album}
              {reveal.album && reveal.year ? " · " : ""}
              {reveal.year}
            </p>
          )}
        </div>

        {isHost ? (
          <Button size="lg" className="neon-glow-green mt-2" disabled={advancing} onClick={handleNext}>
            {advancing ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            Next Round
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">Waiting for the host to continue...</p>
        )}
      </motion.div>
    </motion.div>
  );
}
