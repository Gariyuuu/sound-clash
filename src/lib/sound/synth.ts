"use client";

import { useSettingsStore } from "@/lib/stores/settings-store";

/**
 * Lightweight synthesized sound effects using the native Web Audio API —
 * no bundled audio files. `howler` (installed) is a file/sprite player and
 * doesn't help without real assets, so this is a deliberate substitute
 * rather than a partial howler integration. Swap this module out for real
 * recorded effects (played via howler) later if/when assets are sourced.
 */

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedContext = new Ctor();
  }
  if (sharedContext.state === "suspended") sharedContext.resume().catch(() => {});
  return sharedContext;
}

function effectsVolume(): number {
  return useSettingsStore.getState().volumeEffects / 100;
}

interface Tone {
  freq: number;
  startOffset: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

function playTones(tones: Tone[]) {
  const ctx = getContext();
  const master = effectsVolume();
  if (!ctx || master <= 0) return;

  const now = ctx.currentTime;
  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = tone.type ?? "sine";
    osc.frequency.value = tone.freq;

    const peak = (tone.gain ?? 0.2) * master;
    const start = now + tone.startOffset;
    const end = start + tone.duration;

    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(peak, start + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gainNode).connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

export const sfx = {
  buzz: () => playTones([{ freq: 880, startOffset: 0, duration: 0.12, type: "square", gain: 0.25 }]),
  correct: () =>
    playTones([
      { freq: 523.25, startOffset: 0, duration: 0.12, gain: 0.22 },
      { freq: 659.25, startOffset: 0.1, duration: 0.12, gain: 0.22 },
      { freq: 783.99, startOffset: 0.2, duration: 0.2, gain: 0.24 },
    ]),
  incorrect: () =>
    playTones([
      { freq: 220, startOffset: 0, duration: 0.18, type: "sawtooth", gain: 0.2 },
      { freq: 174.61, startOffset: 0.12, duration: 0.22, type: "sawtooth", gain: 0.2 },
    ]),
  countdownTick: () => playTones([{ freq: 1046.5, startOffset: 0, duration: 0.05, gain: 0.12 }]),
  victory: () =>
    playTones([
      { freq: 523.25, startOffset: 0, duration: 0.15, gain: 0.22 },
      { freq: 659.25, startOffset: 0.15, duration: 0.15, gain: 0.22 },
      { freq: 783.99, startOffset: 0.3, duration: 0.15, gain: 0.22 },
      { freq: 1046.5, startOffset: 0.45, duration: 0.4, gain: 0.26 },
    ]),
  achievement: () =>
    playTones([
      { freq: 659.25, startOffset: 0, duration: 0.1, gain: 0.2 },
      { freq: 987.77, startOffset: 0.08, duration: 0.3, gain: 0.24 },
    ]),
};
