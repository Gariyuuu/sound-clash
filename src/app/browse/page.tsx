"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { GAME_MODE_LABELS } from "@/lib/game/types";
import { LogoFull } from "@/components/branding/logo";
import { NavAuthLinks } from "@/components/home/nav-auth-links";
import { Button } from "@/components/ui/button";
import { SplashScreen } from "@/components/branding/splash-screen";
import { ArrowLeft, Users } from "lucide-react";
import type { RoomRow } from "@/types/database";

type PublicRoom = RoomRow & { room_players: { count: number }[] };

export default function BrowsePage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);

  useEffect(() => {
    api.listPublicRooms(50).then(({ rooms }) => setRooms(rooms));
  }, []);

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" render={<Link href="/" />}>
          <ArrowLeft className="size-4" /> Home
        </Button>
        <LogoFull size={24} />
        <NavAuthLinks />
      </div>

      <h1 className="text-3xl font-extrabold text-center">Public Rooms</h1>

      {!rooms && <SplashScreen label="Finding rooms..." />}

      {rooms && rooms.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
          No public rooms right now — create one and flip it public in host settings!
        </div>
      )}

      {rooms && rooms.length > 0 && (
        <div className="flex flex-col gap-2">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => router.push(`/room/${room.code}`)}
              className="glass rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-white/10 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{room.name}</div>
                <div className="text-xs text-muted-foreground">
                  {GAME_MODE_LABELS[room.settings.mode]} · {room.settings.songCount} songs
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="size-3.5" />
                {room.room_players?.[0]?.count ?? 0}
              </div>
              <span className="font-mono text-sm tracking-widest text-primary">{room.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
