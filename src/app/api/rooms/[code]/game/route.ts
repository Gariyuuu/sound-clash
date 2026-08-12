import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, safeQuery } from "@/lib/db/client";
import { rooms, games, game_rounds, match_history } from "@/lib/db/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const room = await safeQuery(
    () => db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) }),
    undefined
  );
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const game = await safeQuery(
    () =>
      db.query.games.findFirst({
        where: eq(games.room_id, room.id),
        orderBy: desc(games.started_at),
      }),
    undefined
  );

  if (!game) return NextResponse.json({ game: null, round: null });

  const round = await safeQuery(
    () =>
      db.query.game_rounds.findFirst({
        where: eq(game_rounds.game_id, game.id),
        orderBy: desc(game_rounds.round_number),
      }),
    undefined
  );

  let matchHistoryId: string | null = null;
  if (game.status === "finished") {
    const history = await safeQuery(
      () => db.query.match_history.findFirst({ where: eq(match_history.game_id, game.id) }),
      undefined
    );
    matchHistoryId = history?.id ?? null;
  }

  return NextResponse.json({ game, round, matchHistoryId });
}
