"use client";

import { useReducedMotion } from "framer-motion";
import { useSettingsStore } from "@/lib/stores/settings-store";

/**
 * True when motion must be suppressed, from EITHER source:
 *
 *   1. the OS `prefers-reduced-motion: reduce` setting (framer's hook), and
 *   2. this app's own Settings toggle (persisted in the settings store).
 *
 * globals.css already gates CSS animation on both. Neither gate reaches
 * JavaScript-driven motion, though — a framer-motion `animate` prop and a
 * canvas-confetti burst both keep running with reduced motion on, because
 * they never touch the CSS animation/transition properties those rules
 * collapse. Anything driven from JS has to ask this hook itself.
 *
 * Returns false during SSR and the first client render, then settles — so
 * treat it as "reduce motion once known", never as a reason to change layout.
 */
export function useMotionOff(): boolean {
  const osReduce = useReducedMotion();
  const appReduce = useSettingsStore((s) => s.reducedMotion);
  return Boolean(osReduce) || appReduce;
}
