import { create } from "zustand";
import type { RoomRow, RoomSettings } from "@/types/database";
import type { ChatMessage, RoomPlayerSnapshot } from "@/lib/game/types";

interface RoomState {
  room: RoomRow | null;
  players: Record<string, RoomPlayerSnapshot>;
  selfPlayerId: string | null;
  chat: ChatMessage[];
  reactions: { id: string; playerId: string; emoji: string }[];
  typingPlayerIds: Set<string>;

  setRoom: (room: RoomRow) => void;
  setSelfPlayerId: (id: string) => void;
  upsertPlayer: (player: RoomPlayerSnapshot) => void;
  removePlayer: (playerId: string) => void;
  setSettings: (settings: RoomSettings) => void;
  pushChatMessage: (message: ChatMessage) => void;
  pushReaction: (playerId: string, emoji: string) => void;
  setTyping: (playerId: string, isTyping: boolean) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  players: {},
  selfPlayerId: null,
  chat: [],
  reactions: [],
  typingPlayerIds: new Set(),

  setRoom: (room) => set({ room }),
  setSelfPlayerId: (selfPlayerId) => set({ selfPlayerId }),
  upsertPlayer: (player) =>
    set((state) => ({ players: { ...state.players, [player.id]: player } })),
  removePlayer: (playerId) =>
    set((state) => {
      const next = { ...state.players };
      delete next[playerId];
      return { players: next };
    }),
  setSettings: (settings) =>
    set((state) => (state.room ? { room: { ...state.room, settings } } : state)),
  pushChatMessage: (message) =>
    set((state) => ({ chat: [...state.chat.slice(-99), message] })),
  pushReaction: (playerId, emoji) =>
    set((state) => ({
      reactions: [...state.reactions.slice(-19), { id: crypto.randomUUID(), playerId, emoji }],
    })),
  setTyping: (playerId, isTyping) =>
    set((state) => {
      const next = new Set(state.typingPlayerIds);
      if (isTyping) next.add(playerId);
      else next.delete(playerId);
      return { typingPlayerIds: next };
    }),
  reset: () =>
    set({
      room: null,
      players: {},
      selfPlayerId: null,
      chat: [],
      reactions: [],
      typingPlayerIds: new Set(),
    }),
}));
