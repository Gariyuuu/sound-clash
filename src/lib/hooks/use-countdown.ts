"use client";

import { useEffect, useRef, useState } from "react";

/** Ticks down to `endAtMs`, firing `onExpire` exactly once when it crosses zero. */
export function useCountdown(endAtMs: number | null, onExpire?: () => void) {
  const [remainingMs, setRemainingMs] = useState(endAtMs ? Math.max(0, endAtMs - Date.now()) : 0);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    if (!endAtMs) {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, endAtMs - Date.now());
      setRemainingMs(remaining);
      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAtMs]);

  return { remainingMs, remainingSeconds: Math.ceil(remainingMs / 1000) };
}
