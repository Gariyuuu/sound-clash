"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function BuzzerButton({
  disabled,
  locked,
  isSelf,
  onBuzz,
}: {
  disabled: boolean;
  locked: boolean;
  isSelf: boolean;
  onBuzz: () => void;
}) {
  return (
    <motion.button
      onClick={onBuzz}
      disabled={disabled}
      whileTap={!disabled ? { scale: 0.92 } : undefined}
      animate={
        !disabled
          ? { boxShadow: ["0 0 30px rgba(30,215,96,0.4)", "0 0 60px rgba(124,58,237,0.55)", "0 0 30px rgba(30,215,96,0.4)"] }
          : {}
      }
      transition={{ duration: 1.4, repeat: disabled ? 0 : Infinity, ease: "easeInOut" }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-full aspect-square w-56 sm:w-64 mx-auto select-none",
        "bg-gradient-to-br from-emerald-500 to-violet-600 text-white font-extrabold text-xl uppercase tracking-wide",
        "disabled:opacity-40 disabled:cursor-not-allowed transition-opacity",
        isSelf && locked && "ring-4 ring-white"
      )}
    >
      <Zap className="size-14 fill-current" />
      {locked ? (isSelf ? "It's you!" : "Locked") : "I KNOW IT!"}
    </motion.button>
  );
}
