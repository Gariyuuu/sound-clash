"use client";

import { motion } from "framer-motion";
import { Zap, Ban, Eye, Pause } from "lucide-react";
import { useMotionOff } from "@/lib/hooks/use-motion-off";
import { cn } from "@/lib/utils";

/** Why the buzzer is unavailable, so a dimmed circle isn't the whole message. */
export type BuzzerBlock = "spectating" | "answered" | "paused" | "waiting" | null;

const BLOCK_COPY: Record<NonNullable<BuzzerBlock>, { label: string; Icon: typeof Zap }> = {
  spectating: { label: "Spectating", Icon: Eye },
  answered: { label: "You answered", Icon: Ban },
  paused: { label: "Paused", Icon: Pause },
  waiting: { label: "Wait for the clip", Icon: Zap },
};

export function BuzzerButton({
  disabled,
  block,
  onBuzz,
}: {
  disabled: boolean;
  block: BuzzerBlock;
  onBuzz: () => void;
}) {
  const motionOff = useMotionOff();
  const state = disabled ? BLOCK_COPY[block ?? "waiting"] : null;
  const Icon = state?.Icon ?? Zap;

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        onClick={onBuzz}
        disabled={disabled}
        aria-label={disabled ? `Buzzer unavailable — ${state?.label}` : "Buzz in — I know it"}
        whileTap={!disabled ? { scale: 0.92 } : undefined}
        animate={
          !disabled && !motionOff
            ? { boxShadow: ["0 0 30px rgba(30,215,96,0.4)", "0 0 60px rgba(124,58,237,0.55)", "0 0 30px rgba(30,215,96,0.4)"] }
            : { boxShadow: "0 0 30px rgba(30,215,96,0.4)" }
        }
        transition={
          motionOff
            ? { duration: 0 }
            : { duration: 1.4, repeat: disabled ? 0 : Infinity, ease: "easeInOut" }
        }
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-full aspect-square w-56 sm:w-64 mx-auto select-none",
          "bg-gradient-to-br from-emerald-500 to-violet-600 text-white font-extrabold text-xl uppercase tracking-wide",
          "disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        )}
      >
        <Icon className={cn("size-14", !disabled && "fill-current")} aria-hidden />
        {disabled ? state?.label : "I KNOW IT!"}
      </motion.button>
      {disabled && block === "answered" && (
        <p className="text-sm text-muted-foreground">You already answered this round — waiting for it to resolve.</p>
      )}
    </div>
  );
}
