"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { THEME_BACKGROUNDS } from "@/lib/theme-backgrounds";
import type { ThemeBackground } from "@/lib/stores/settings-store";
import { cn } from "@/lib/utils";

const WHEEL_SIZE = 260;
const RADIUS = 100;
const SWATCH_SIZE = 52;

interface ThemeWheelProps {
  options: Exclude<ThemeBackground, "custom">[];
  labels: Record<ThemeBackground, string>;
  value: ThemeBackground;
  onChange: (bg: ThemeBackground) => void;
}

/**
 * A circular "wheel" arrangement of the background presets, instead of a
 * plain grid — each swatch sits on the rim of a circle, evenly spaced by
 * angle. Clicking a swatch selects it and spins the wheel so the chosen one
 * rotates to the top; the center shows the current selection's name.
 */
export function ThemeWheel({ options, labels, value, onChange }: ThemeWheelProps) {
  const selectedIndex = Math.max(0, options.indexOf(value as Exclude<ThemeBackground, "custom">));
  const [rotation, setRotation] = useState(() => -(360 / options.length) * selectedIndex);

  function handleSelect(bg: Exclude<ThemeBackground, "custom">, index: number) {
    onChange(bg);
    setRotation(-(360 / options.length) * index);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative shrink-0"
        style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          {options.map((bg, i) => {
            const angle = (360 / options.length) * i - 90;
            const rad = (angle * Math.PI) / 180;
            const x = WHEEL_SIZE / 2 + RADIUS * Math.cos(rad) - SWATCH_SIZE / 2;
            const y = WHEEL_SIZE / 2 + RADIUS * Math.sin(rad) - SWATCH_SIZE / 2;
            const isSelected = bg === value;
            return (
              <motion.button
                key={bg}
                type="button"
                onClick={() => handleSelect(bg, i)}
                title={labels[bg]}
                className={cn(
                  "absolute rounded-full border-2 overflow-hidden transition-shadow",
                  isSelected ? "border-primary neon-ring z-10" : "border-white/15 hover:border-white/40"
                )}
                style={{
                  width: SWATCH_SIZE,
                  height: SWATCH_SIZE,
                  left: x,
                  top: y,
                  background: THEME_BACKGROUNDS[bg] || "#222",
                  rotate: -rotation,
                }}
                animate={{ scale: isSelected ? 1.15 : 1, rotate: -rotation }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
              />
            );
          })}
        </motion.div>

        {/* Hub */}
        <div
          className="absolute rounded-full glass-strong flex flex-col items-center justify-center text-center p-2 pointer-events-none"
          style={{
            width: RADIUS,
            height: RADIUS,
            left: WHEEL_SIZE / 2 - RADIUS / 2,
            top: WHEEL_SIZE / 2 - RADIUS / 2,
          }}
        >
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Background</span>
          <span className="text-sm font-bold">{labels[value]}</span>
        </div>

        {/* Pointer at the top, marking the "selected" slot */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-1 w-0 h-0"
          style={{
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "8px solid var(--primary)",
          }}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
        {options.map((bg, i) => (
          <button
            key={bg}
            type="button"
            onClick={() => handleSelect(bg, i)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium border transition",
              bg === value ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-muted-foreground"
            )}
          >
            {labels[bg]}
          </button>
        ))}
      </div>
    </div>
  );
}
