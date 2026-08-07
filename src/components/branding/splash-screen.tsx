"use client";

import { motion } from "framer-motion";
import { LogoMark } from "./logo";

export function SplashScreen({ label = "Tuning in..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#0a0e17]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-500/20 blur-[100px]" />
      </div>

      <motion.div
        initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="relative"
      >
        <motion.div
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <LogoMark size={96} />
        </motion.div>
      </motion.div>

      <div className="relative flex flex-col items-center gap-3">
        <span className="text-lg font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-violet-400">
          Sound Clash
        </span>
        <div className="flex items-end gap-1 h-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 rounded-full bg-gradient-to-b from-emerald-400 to-violet-400"
              animate={{ height: ["30%", "100%", "30%"] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
              style={{ height: "30%" }}
            />
          ))}
        </div>
        <span className="text-sm text-white/50">{label}</span>
      </div>
    </div>
  );
}
