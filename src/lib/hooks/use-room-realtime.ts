"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "ably";
import { getAblyClient } from "@/lib/ably/client";
import { useRoomStore } from "@/lib/stores/room-store";
import { AI_BOT_GUEST_ID } from "@/lib/game/ai-bot";
import type { RoomPlayerRow, RoomRow, RoomMessageRow } from "@/types/database";
import type { RoomPlayerSnapshot } from "@/lib/game/types";

function toSnapshot(row: RoomPlayerRow): RoomPlayerSnapshot {
  return {
    id: row.id,
    profileId: row.profile_id,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    isHost: row.is_host,
    isSpectator: row.is_spectator,
    isReady: row.is_ready,
    isAI: row.guest_id === AI_BOT_GUEST_ID,
    team: row.team,
    score: row.score,
    streak: row.streak,
    connectionStatus: row.connection_status,
  };
}

/**
 * Subscribes to the room's Ably channel (`room:{roomId}`) — the replacement
 * for Supabase's Postgres Changes (see DECISIONS.md D-013). Every mutating
 * API route that touches `rooms`/`room_players`/`room_messages` explicitly
 * publishes an event here after writing to Neon; there is no automatic
 * DB-to-realtime bridge with Neon the way there was with Supabase, so the
 * event contract below (event name → payload shape) is the actual
 * client/server contract now — see any file under
 * `src/app/api/rooms/[code]/` for the publish side.
 *
 * The typing indicator is the one thing published without a DB write at
 * all (an ephemeral "typing" event), same as it was with Supabase Broadcast.
 */
export function useRoomRealtime(roomId: string | null) {
  const upsertPlayer = useRoomStore((s) => s.upsertPlayer);
  const removePlayer = useRoomStore((s) => s.removePlayer);
  const setRoom = useRoomStore((s) => s.setRoom);
  const pushChatMessage = useRoomStore((s) => s.pushChatMessage);
  const pushReaction = useRoomStore((s) => s.pushReaction);
  const setTyping = useRoomStore((s) => s.setTyping);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const ably = getAblyClient();
    const channel = ably.channels.get(`room:${roomId}`);
    channelRef.current = channel;

    channel.subscribe("player_upsert", (msg) => {
      const row = msg.data as RoomPlayerRow;
      if (row.connection_status === "banned" || row.connection_status === "kicked") {
        removePlayer(row.id);
      } else {
        upsertPlayer(toSnapshot(row));
      }
    });

    channel.subscribe("room_update", (msg) => setRoom(msg.data as RoomRow));

    channel.subscribe("message", (msg) => {
      const row = msg.data as RoomMessageRow;
      if (row.kind === "reaction") {
        pushReaction(row.player_id ?? "system", row.body);
      } else {
        pushChatMessage({
          id: row.id,
          playerId: row.player_id ?? "system",
          displayName: row.display_name,
          body: row.body,
          sentAt: row.created_at,
        });
      }
    });

    channel.subscribe("typing", (msg) => {
      const { playerId, isTyping } = msg.data as { playerId: string; isTyping: boolean };
      setTyping(playerId, isTyping);
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomId, upsertPlayer, removePlayer, setRoom, pushChatMessage, pushReaction, setTyping]);

  const sendTyping = useCallback((playerId: string, isTyping: boolean) => {
    channelRef.current?.publish("typing", { playerId, isTyping });
  }, []);

  return { sendTyping };
}
