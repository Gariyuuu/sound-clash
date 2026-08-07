import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, games, game_rounds, match_history } from "@/lib/db/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const game = await db.query.games.findFirst({
    where: eq(games.room_id, room.id),
    orderBy: desc(games.started_at),
  });

  if (!game) return NextResponse.json({ game: null, round: null });

  const round = await db.query.game_rounds.findFirst({
    where: eq(game_rounds.game_id, game.id),
    orderBy: desc(game_rounds.round_number),
  });

  let matchHistoryId: string | null = null;
  if (game.status === "finished") {
    const history = await db.query.match_history.findFirst({ where: eq(match_history.game_id, game.id) });
    matchHistoryId = history?.id ?? null;
  }

  return NextResponse.json({ game, round, matchHistoryId });
}
