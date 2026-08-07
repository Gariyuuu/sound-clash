"use client";

import { Music4 } from "lucide-react";
import { useSettingsStore } from "@/lib/stores/settings-store";

/**
 * Plays a YouTube clip for audio only. The iframe itself is rendered
 * off-screen (not display:none/visibility:hidden, which some browsers
 * throttle) — even with controls=0, YouTube's embed still shows the video
 * title/channel/thumbnail overlay on load and pause, which would hand away
 * the answer in a guessing game. The visible surface is a generic "now
 * playing" placeholder, same visual language as SpotifyPreviewPlayer.
 *
 * Clip start/end come from the server-authoritative round payload so every
 * player's clip is trimmed identically; `key={videoId+start}` on the caller
 * forces a remount (and therefore a fresh play) each round instead of trying
 * to seek an existing player instance.
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
  coverUrl,
}: {
  videoId: string;
  startSeconds: number;
  durationSeconds: number;
  coverUrl?: string | null;
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
    <div className="aspect-video w-full max-w-md mx-auto rounded-2xl overflow-hidden glass-strong flex items-center justify-center relative">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40" />
      ) : null}
      <Music4 className="size-16 text-emerald-400 relative" />
      <div className="absolute w-px h-px overflow-hidden -left-[9999px] -top-[9999px]" aria-hidden="true">
        <iframe
          key={`${videoId}-${startSeconds}`}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
          title="Now playing"
          allow="autoplay; encrypted-media"
          width="1"
          height="1"
        />
      </div>
    </div>
  );
}
