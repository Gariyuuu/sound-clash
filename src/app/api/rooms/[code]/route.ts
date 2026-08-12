import { NextResponse } from "next/server";
import { eq, and, ne, asc } from "drizzle-orm";
import { db, safeQuery } from "@/lib/db/client";
import { rooms, room_players } from "@/lib/db/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const room = await safeQuery(
    () => db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) }),
    undefined
  );
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const players = await safeQuery(
    () =>
      db
        .select()
        .from(room_players)
        .where(and(eq(room_players.room_id, room.id), ne(room_players.connection_status, "banned")))
        .orderBy(asc(room_players.joined_at)),
    []
  );

  return NextResponse.json({ room, players });
}
