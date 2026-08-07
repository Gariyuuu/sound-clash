import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { game_rounds, games, room_players } from "@/lib/db/schema";
import { createRoundForGame } from "@/lib/game/round-service";
import { finishGame } from "@/lib/game/end-game";

interface NextBody {
  requesterPlayerId: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const { requesterPlayerId } = (await request.json()) as NextBody;

  const round = await db.query.game_rounds.findFirst({ where: eq(game_rounds.id, roundId) });
  if (!round) return NextResponse.json({ error: "Round not found." }, { status: 404 });

  const game = await db.query.games.findFirst({ where: eq(games.id, round.game_id) });
  if (!game) return NextResponse.json({ error: "Game missing." }, { status: 500 });

  const requester = await db.query.room_players.findFirst({
    where: and(eq(room_players.id, requesterPlayerId), eq(room_players.room_id, game.room_id)),
  });
  if (!requester?.is_host) return NextResponse.json({ error: "Only the host can advance." }, { status: 403 });

  if (round.status !== "resolved" && round.status !== "skipped") {
    return NextResponse.json({ error: "Current round isn't finished yet." }, { status: 409 });
  }

  const nextRoundNumber = round.round_number + 1;
  if (nextRoundNumber > game.song_order.length) {
    const matchHistory = await finishGame(game);
    return NextResponse.json({ ended: true, matchHistoryId: matchHistory?.id });
  }

  const result = await createRoundForGame(game, nextRoundNumber);
  if (!result) return NextResponse.json({ error: "Failed to create next round." }, { status: 500 });

  return NextResponse.json({ round: result.round });
}
