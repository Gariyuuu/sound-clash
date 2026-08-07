"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AnswerCategory } from "@/types/database";

const CATEGORY_LABEL: Record<AnswerCategory, string> = {
  title: "Song Name",
  artist: "Artist",
  featured_artist: "Featured Artist",
  album: "Album",
  chorus: "Correct Chorus / Lyrics",
};

export function AnswerPanel({
  categories,
  onSubmit,
  submitting,
}: {
  categories: AnswerCategory[];
  onSubmit: (answers: Partial<Record<AnswerCategory, string>>) => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Partial<Record<AnswerCategory, string>>>({});

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(answers);
      }}
      className="glass-strong rounded-2xl p-5 flex flex-col gap-3 w-full max-w-md mx-auto"
    >
      <p className="text-sm text-muted-foreground text-center">You buzzed in! Answer fast:</p>
      {categories.map((cat) => (
        <div key={cat} className="flex flex-col gap-1">
          <Label htmlFor={`answer-${cat}`}>{CATEGORY_LABEL[cat]}</Label>
          <Input
            id={`answer-${cat}`}
            autoFocus={cat === categories[0]}
            value={answers[cat] ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [cat]: e.target.value }))}
            disabled={submitting}
          />
        </div>
      ))}
      <Button type="submit" disabled={submitting} className="neon-glow-violet mt-1">
        {submitting ? "Submitting..." : "Submit answer"}
      </Button>
    </form>
  );
}
