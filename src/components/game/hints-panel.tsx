"use client";

import { Button } from "@/components/ui/button";
import type { RevealedHint } from "@/lib/game/types";
import { Lightbulb } from "lucide-react";

const HINT_LABELS: Record<RevealedHint["kind"], string> = {
  first_letter: "First Letter",
  last_letter: "Last Letter",
  year: "Year",
  genre: "Genre",
  duration: "Duration",
  cover_blur: "Cover Art",
  random_letters: "Random Letters",
  artist_silhouette: "Artist Silhouette",
  word_count: "Word Count",
};

const ALL_HINT_KINDS = Object.keys(HINT_LABELS) as RevealedHint["kind"][];

export function HintsPanel({
  revealed,
  isHost,
  canReveal,
  onReveal,
}: {
  revealed: RevealedHint[];
  isHost: boolean;
  canReveal: boolean;
  onReveal: (kind: RevealedHint["kind"]) => void;
}) {
  const revealedKinds = new Set(revealed.map((h) => h.kind));

  return (
    <div className="flex flex-col gap-2 items-center">
      {revealed.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {revealed.map((hint, i) => (
            <div key={i} className="glass rounded-full px-3 py-1.5 text-sm flex items-center gap-1.5">
              <Lightbulb className="size-3.5 text-amber-400" />
              <span className="text-muted-foreground">{HINT_LABELS[hint.kind]}:</span>
              <span className="font-semibold">{hint.value}</span>
            </div>
          ))}
        </div>
      )}
      {isHost && canReveal && (
        <div className="flex flex-wrap justify-center gap-1.5 mt-1">
          {ALL_HINT_KINDS.filter((k) => !revealedKinds.has(k)).map((kind) => (
            <Button key={kind} size="sm" variant="outline" onClick={() => onReveal(kind)}>
              + {HINT_LABELS[kind]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
