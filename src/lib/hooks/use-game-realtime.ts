"use client";

import { useEffect, useRef } from "react";
import { getAblyClient } from "@/lib/ably/client";
import { useGameStore } from "@/lib/stores/game-store";
import { useRoomStore } from "@/lib/stores/room-store";
import { CHAOS_RULES, type ChaosRuleKey, type RevealedHint, type RoundBroadcastPayload, type RoundRevealPayload } from "@/lib/game/types";
import type { AnswerCategory, GameRoundRow, GameRow, RoundAnswerRow, RoundLockRow } from "@/types/database";

const CATEGORY_LABEL: Record<AnswerCategory, string> = {
  title: "Song Name",
  artist: "Artist",
  featured_artist: "Featured Artist",
  album: "Album",
  chorus: "Correct Chorus/Lyrics",
};

/**
 * Subscribes to the game's Ably channel (`game:{gameId}`) — see
 * use-room-realtime.ts's header comment for the general Ably-replaces-
 * Postgres-Changes context (DECISIONS.md D-013). Event names below
 * (`round_insert`/`round_update`/`lock_insert`/`answer_insert`/
 * `game_update`) are the actual contract with the server — see any file
 * under `src/app/api/rounds/` or `src/app/api/rooms/[code]/control` for the
 * publish side.
 */
export function useGameRealtime(gameId: string | null) {
  const startRound = useGameStore((s) => s.startRound);
  const lockBuzz = useGameStore((s) => s.lockBuzz);
  const startSteal = useGameStore((s) => s.startSteal);
  const addHint = useGameStore((s) => s.addHint);
  const resolveRound = useGameStore((s) => s.resolveRound);
  const pushPopup = useGameStore((s) => s.pushPopup);
  const setPaused = useGameStore((s) => s.setPaused);
  const setChaosLabel = useGameStore((s) => s.setChaosLabel);
  const setExcludedPlayerIds = useGameStore((s) => s.setExcludedPlayerIds);
  const players = useRoomStore((s) => s.players);
  const playersRef = useRef(players);
  playersRef.current = players;

  useEffect(() => {
    if (!gameId) return;
    const ably = getAblyClient();
    const channel = ably.channels.get(`game:${gameId}`);
    let knownHintCount = 0;

    channel.subscribe("round_insert", (msg) => {
      const row = msg.data as GameRoundRow & {
        broadcast_payload: RoundBroadcastPayload | null;
        chaos_rule: ChaosRuleKey | null;
      };
      knownHintCount = 0;
      if (row.broadcast_payload) startRound(row.broadcast_payload);
      setChaosLabel(row.chaos_rule ? CHAOS_RULES[row.chaos_rule] : null);
      setExcludedPlayerIds([]);
    });

    channel.subscribe("round_update", (msg) => {
      const row = msg.data as GameRoundRow & {
        reveal_payload: RoundRevealPayload | null;
        revealed_hints: RevealedHint[];
      };

      if (row.status === "steal") {
        startSteal(row.current_phase, row.phase_started_at);
      }
      setExcludedPlayerIds(row.excluded_player_ids ?? []);
      if (row.revealed_hints?.length > knownHintCount) {
        const newest = row.revealed_hints[row.revealed_hints.length - 1];
        addHint(newest);
        knownHintCount = row.revealed_hints.length;
      }
      if ((row.status === "resolved" || row.status === "skipped") && row.reveal_payload) {
        resolveRound(row.reveal_payload, {});
      }
    });

    channel.subscribe("lock_insert", (msg) => {
      const row = msg.data as RoundLockRow;
      const player = playersRef.current[row.player_id];
      lockBuzz(row.player_id, player?.displayName ?? "A player", row.phase, row.buzzed_at);
    });

    channel.subscribe("answer_insert", (msg) => {
      const row = msg.data as RoundAnswerRow;
      if (row.correct) {
        pushPopup(row.player_id, [{ label: CATEGORY_LABEL[row.category], points: row.points }]);
      }
    });

    channel.subscribe("game_update", (msg) => {
      const row = msg.data as GameRow;
      setPaused(row.paused);
    });

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);
}
