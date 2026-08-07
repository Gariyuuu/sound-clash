"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useIdentity } from "@/lib/hooks/use-identity";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";

export function CreateRoomButton() {
  const router = useRouter();
  const identity = useIdentity();
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (identity.loading) return;
    const name = identity.displayName.trim() || "Host";
    setLoading(true);
    try {
      const { room } = await api.createRoom({
        hostDisplayName: name,
        hostAvatarEmoji: identity.avatarEmoji,
        hostProfileId: identity.profileId ?? undefined,
        hostGuestId: identity.profileId ? undefined : identity.guestId,
      });
      router.push(`/room/${room.code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create room.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="lg" onClick={handleCreate} disabled={loading} className="h-14 px-8 text-base neon-glow-green">
      {loading ? <Loader2 className="animate-spin" /> : <Zap className="fill-current" />}
      Create Room
    </Button>
  );
}
