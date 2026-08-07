import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { game_rounds, games, room_players, songs } from "@/lib/db/schema";
import { buildHint } from "@/lib/game/round-payload";
import { hintsAllowed } from "@/lib/game/rules";
import { publish, gameChannel } from "@/lib/ably/publish";
import type { RevealedHint } from "@/lib/game/types";
import type { RoomSettings } from "@/types/database";

interface HintBody {
  requesterPlayerId: string;
  kind: RevealedHint["kind"];
}

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const { requesterPlayerId, kind } = (await request.json()) as HintBody;

  const round = await db.query.game_rounds.findFirst({ where: eq(game_rounds.id, roundId) });
  if (!round) return NextResponse.json({ error: "Round not found." }, { status: 404 });
  if (round.status !== "playing") return NextResponse.json({ error: "Hints only available before a buzz." }, { status: 409 });

  const game = await db.query.games.findFirst({ where: eq(games.id, round.game_id) });
  if (!game) return NextResponse.json({ error: "Game missing." }, { status: 500 });

  const requester = await db.query.room_players.findFirst({
    where: and(eq(room_players.id, requesterPlayerId), eq(room_players.room_id, game.room_id)),
  });
  if (!requester?.is_host) return NextResponse.json({ error: "Only the host can reveal hints." }, { status: 403 });

  const settings = game.settings as RoomSettings;
  if (!hintsAllowed(settings)) return NextResponse.json({ error: "Hints are disabled for this mode." }, { status: 400 });

  const song = await db.query.songs.findFirst({ where: eq(songs.id, round.song_id) });
  if (!song) return NextResponse.json({ error: "Song missing." }, { status: 500 });

  const hint = buildHint(kind, song);
  const revealedHints = [...(round.revealed_hints as RevealedHint[]), hint];

  const [updated] = await db
    .update(game_rounds)
    .set({ revealed_hints: revealedHints })
    .where(eq(game_rounds.id, roundId))
    .returning();
  if (updated) await publish(gameChannel(game.id), "round_update", updated);

  return NextResponse.json({ hint });
}
