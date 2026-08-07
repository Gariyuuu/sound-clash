"use client";

import { useEffect, useRef } from "react";
import { Music4 } from "lucide-react";
import { useSettingsStore } from "@/lib/stores/settings-store";

/**
 * Plays a Spotify 30s preview clip via a plain <audio> element — Spotify
 * preview URLs are direct MP3 links, no SDK/player needed. Used when a
 * round's song has no YouTube video id (Spotify-only or "mixed" source).
 */
export function SpotifyPreviewPlayer({ previewUrl, coverUrl }: { previewUrl: string; coverUrl: string | null }) {
  const volumeMusic = useSettingsStore((s) => s.volumeMusic);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = Math.min(1, Math.max(0, volumeMusic / 100));
  }, [volumeMusic]);

  useEffect(() => {
    audioRef.current?.play().catch(() => {});
  }, [previewUrl]);

  return (
    <div className="aspect-video w-full max-w-md mx-auto rounded-2xl overflow-hidden glass-strong flex items-center justify-center relative">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40" />
      ) : null}
      <Music4 className="size-16 text-emerald-400 relative" />
      <audio ref={audioRef} key={previewUrl} src={previewUrl} autoPlay />
    </div>
  );
}
