"use client";

import { useEffect, useRef, useState } from "react";
import { useRoomStore } from "@/lib/stores/room-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { SendHorizonal } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["🔥", "😂", "😱", "👏", "💀", "🎵"];
const TYPING_IDLE_MS = 2000;

export function RoomChat({ code, sendTyping }: { code: string; sendTyping: (playerId: string, isTyping: boolean) => void }) {
  const chat = useRoomStore((s) => s.chat);
  const reactions = useRoomStore((s) => s.reactions);
  const selfPlayerId = useRoomStore((s) => s.selfPlayerId);
  const players = useRoomStore((s) => s.players);
  const typingPlayerIds = useRoomStore((s) => s.typingPlayerIds);
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length]);

  const self = selfPlayerId ? players[selfPlayerId] : null;
  const typingNames = [...typingPlayerIds]
    .filter((id) => id !== selfPlayerId)
    .map((id) => players[id]?.displayName)
    .filter(Boolean);

  function handleMessageChange(value: string) {
    setMessage(value);
    if (!self) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(self.id, true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(self.id, false);
    }, TYPING_IDLE_MS);
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !self) return;
    setMessage("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    sendTyping(self.id, false);
    await api.sendMessage(code, { playerId: self.id, displayName: self.displayName, kind: "chat", body: message });
  }

  async function sendReaction(emoji: string) {
    if (!self) return;
    await api.sendMessage(code, { playerId: self.id, displayName: self.displayName, kind: "reaction", body: emoji });
  }

  return (
    <div className="glass rounded-2xl p-4 flex flex-col h-full min-h-[280px]">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Chat</h3>
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 text-sm">
        {chat.map((m) => (
          <div key={m.id} className={cn(m.playerId === "system" && "text-muted-foreground italic")}>
            {m.playerId !== "system" && <span className="font-semibold">{m.displayName}: </span>}
            {m.body}
          </div>
        ))}
        {chat.length === 0 && <p className="text-muted-foreground text-sm">Say hi to the room 👋</p>}
      </div>

      <div className="h-4 text-xs text-muted-foreground italic truncate">
        {typingNames.length > 0 && `${typingNames.join(", ")} ${typingNames.length === 1 ? "is" : "are"} typing...`}
      </div>

      <div className="flex gap-1 py-2 flex-wrap">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-lg hover:scale-125 transition-transform"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <form onSubmit={sendChat} className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => handleMessageChange(e.target.value)}
          placeholder="Type a message..."
          maxLength={280}
        />
        <Button type="submit" size="icon" variant="secondary">
          <SendHorizonal className="size-4" />
        </Button>
      </form>

      <div className="pointer-events-none fixed bottom-4 right-4 flex flex-col items-end gap-1">
        {reactions.slice(-5).map((r) => (
          <span key={r.id} className="text-2xl animate-bounce">
            {r.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}
