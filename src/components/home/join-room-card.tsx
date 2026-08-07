"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function JoinRoomCard() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      toast.error("Enter a valid room code.");
      return;
    }
    setLoading(true);
    router.push(`/room/${trimmed}`);
  }

  return (
    <form onSubmit={handleJoin} className="flex w-full max-w-md gap-2">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ENTER ROOM CODE"
        maxLength={6}
        className="text-center tracking-[0.3em] font-mono text-lg h-14 glass"
      />
      <Button type="submit" size="lg" disabled={loading} className="h-14 px-8 neon-glow-violet">
        Join
      </Button>
    </form>
  );
}
