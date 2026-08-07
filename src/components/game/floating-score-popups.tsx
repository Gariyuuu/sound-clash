"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import { useRoomStore } from "@/lib/stores/room-store";

/** Renders game-store.popups as auto-dismissing floating "+points" toasts. */
export function FloatingScorePopups() {
  const popups = useGameStore((s) => s.popups);
  const clearPopup = useGameStore((s) => s.clearPopup);
  const players = useRoomStore((s) => s.players);

  useEffect(() => {
    if (popups.length === 0) return;
    const timers = popups.map((p) => setTimeout(() => clearPopup(p.id), 2200));
    return () => timers.forEach(clearTimeout);
  }, [popups, clearPopup]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2">
      <AnimatePresence>
        {popups.map((popup) => (
          <motion.div
            key={popup.id}
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.4 }}
            className={
              "glass-strong rounded-full px-4 py-1.5 text-sm font-semibold flex items-center gap-2 " +
              (popup.points >= 0 ? "text-emerald-400" : "text-destructive")
            }
          >
            <span className="text-muted-foreground font-normal">
              {players[popup.playerId]?.displayName ?? "Player"}
            </span>
            {popup.label}
            <span>{popup.points >= 0 ? `+${popup.points}` : popup.points}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
