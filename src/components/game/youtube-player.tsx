"use client";

import { useSettingsStore } from "@/lib/stores/settings-store";

/**
 * Thin wrapper around the YouTube iframe embed. Clip start/end come from the
 * server-authoritative round payload so every player's clip is trimmed
 * identically; `key={videoId+start}` on the caller forces a remount (and
 * therefore a fresh play) each round instead of trying to seek an existing
 * player instance.
 *
 * Known limitation: true audio manipulation (vocal removal for Instrumental
 * Mode, reversed playback for Reverse Intro) isn't possible against a
 * YouTube iframe embed without downloading and reprocessing the audio
 * server-side, which is out of scope for a free-tier deployment. Those modes
 * change scoring/hint rules but play the clip normally — see README.md
 * "Known limitations".
 */
export function YoutubePlayer({
  videoId,
  startSeconds,
  durationSeconds,
}: {
  videoId: string;
  startSeconds: number;
  durationSeconds: number;
}) {
  const volumeMusic = useSettingsStore((s) => s.volumeMusic);
  const muted = volumeMusic === 0;

  const params = new URLSearchParams({
    autoplay: "1",
    start: String(startSeconds),
    end: String(startSeconds + durationSeconds),
    mute: muted ? "1" : "0",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
  });

  return (
    <div className="aspect-video w-full max-w-md mx-auto rounded-2xl overflow-hidden glass-strong">
      <iframe
        key={`${videoId}-${startSeconds}`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
        title="Now playing"
        allow="autoplay; encrypted-media"
        className="w-full h-full"
      />
    </div>
  );
}
