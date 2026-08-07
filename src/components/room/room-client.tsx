"use client";

import { useCallback, useEffect, useState } from "react";
import { useIdentity } from "@/lib/hooks/use-identity";
import { useRoomRealtime } from "@/lib/hooks/use-room-realtime";
import { useRoomStore } from "@/lib/stores/room-store";
import { api } from "@/lib/api-client";
import { SplashScreen } from "@/components/branding/splash-screen";
import { NameGate } from "@/components/room/name-gate";
import { LobbyView } from "@/components/room/lobby-view";
import { GameplayView } from "@/components/room/gameplay-view";
import { ResultsView } from "@/components/room/results-view";
import { AI_BOT_GUEST_ID } from "@/lib/game/ai-bot";
import type { RoomPlayerRow } from "@/types/database";
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

export function RoomClient({ code }: { code: string }) {
  const identity = useIdentity();
  const room = useRoomStore((s) => s.room);
  const selfPlayerId = useRoomStore((s) => s.selfPlayerId);
  const setRoom = useRoomStore((s) => s.setRoom);
  const setSelfPlayerId = useRoomStore((s) => s.setSelfPlayerId);
  const upsertPlayer = useRoomStore((s) => s.upsertPlayer);
  const reset = useRoomStore((s) => s.reset);

  const [status, setStatus] = useState<"loading" | "needs-name" | "joining" | "ready" | "not-found">("loading");
  const [error, setError] = useState<string | null>(null);
  const [askSpectator, setAskSpectator] = useState(false);

  const { sendTyping } = useRoomRealtime(room?.id ?? null);

  const join = useCallback(
    async (asSpectator = false) => {
      setStatus("joining");
      setError(null);
      try {
        const { room: fetchedRoom } = await api.getRoom(code);
        const { room: joinedRoom, player } = await api.joinRoom(code, {
          displayName: identity.displayName,
          avatarEmoji: identity.avatarEmoji,
          profileId: identity.profileId ?? undefined,
          guestId: identity.profileId ? undefined : identity.guestId,
          isSpectator: asSpectator,
        });
        setRoom(joinedRoom ?? fetchedRoom);
        setSelfPlayerId(player.id);
        upsertPlayer(toSnapshot(player));

        const { players } = await api.getRoom(code);
        players.filter((p) => p.connection_status !== "kicked").forEach((p) => upsertPlayer(toSnapshot(p)));

        setStatus("ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to join room.";
        if (message.includes("spectator")) {
          setAskSpectator(true);
          setStatus("needs-name");
        } else if (message.includes("not found")) {
          setStatus("not-found");
        } else {
          setError(message);
          setStatus("needs-name");
        }
      }
    },
    [code, identity.displayName, identity.avatarEmoji, identity.profileId, identity.guestId, setRoom, setSelfPlayerId, upsertPlayer]
  );

  useEffect(() => {
    if (identity.loading) return;
    if (!identity.displayName.trim()) {
      setStatus("needs-name");
      return;
    }
    join();
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.loading]);

  useEffect(() => {
    function handleUnload() {
      if (selfPlayerId) {
        navigator.sendBeacon(`/api/rooms/${code}/leave`, JSON.stringify({ playerId: selfPlayerId }));
      }
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [code, selfPlayerId]);

  if (status === "not-found") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Room not found</h1>
        <p className="text-muted-foreground">Double check the code — rooms disappear once everyone leaves.</p>
      </div>
    );
  }

  if (status === "needs-name") {
    return (
      <NameGate
        identity={identity}
        error={error}
        askSpectator={askSpectator}
        onSubmit={(asSpectator) => join(asSpectator)}
      />
    );
  }

  if (status === "loading" || status === "joining" || !room || !selfPlayerId) {
    return <SplashScreen label="Joining room..." />;
  }

  if (room.status === "lobby") return <LobbyView code={code} sendTyping={sendTyping} />;
  if (room.status === "playing") return <GameplayView code={code} />;
  return <ResultsView code={code} />;
}
