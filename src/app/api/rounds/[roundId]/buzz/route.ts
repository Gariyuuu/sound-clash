import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { game_rounds, round_locks, room_players } from "@/lib/db/schema";
import { publish, gameChannel } from "@/lib/ably/publish";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

interface BuzzBody {
  playerId: string;
  clientLatencyMs?: number;
}

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  // Buzzing is the highest-frequency action in the game (up to 20 players
  // racing simultaneously) — a generous but real limit stops a malicious
  // client from hammering the endpoint to try to win every race.
  const limited = rateLimit(clientKeyFromRequest(request, "rounds:buzz"), 30, 10_000);
  if (!limited.success) {
    return NextResponse.json({ error: "Slow down." }, { status: 429 });
  }

  const { roundId } = await params;
  const { playerId, clientLatencyMs = 0 } = (await request.json()) as BuzzBody;

  const round = await db.query.game_rounds.findFirst({ where: eq(game_rounds.id, roundId) });
  if (!round) return NextResponse.json({ error: "Round not found." }, { status: 404 });
  if (round.status !== "playing" && round.status !== "steal") {
    return NextResponse.json({ locked: false, reason: "round_over" });
  }
  if (round.excluded_player_ids.includes(playerId)) {
    return NextResponse.json({ locked: false, reason: "excluded" }, { status: 403 });
  }

  // Atomic buzz-race arbitration: `round_locks` primary key is
  // (round_id, phase), so whoever's insert wins the unique-constraint race
  // gets the buzzer — see DO NOT CHANGE WITHOUT REVIEW in CLAUDE.md.
  const inserted = await db
    .insert(round_locks)
    .values({
      round_id: roundId,
      phase: round.current_phase,
      player_id: playerId,
      client_latency_ms: Math.max(0, Math.min(2000, clientLatencyMs)),
    })
    .onConflictDoNothing({ target: [round_locks.round_id, round_locks.phase] })
    .returning();

  const won = inserted.length > 0 && inserted[0]!.player_id === playerId;

  if (!won) {
    const holder = await db.query.round_locks.findFirst({
      where: and(eq(round_locks.round_id, roundId), eq(round_locks.phase, round.current_phase)),
    });
    return NextResponse.json({ locked: false, holderId: holder?.player_id ?? null });
  }

  const player = await db.query.room_players.findFirst({ where: eq(room_players.id, playerId) });
  await publish(gameChannel(round.game_id), "lock_insert", inserted[0]);

  return NextResponse.json({ locked: true, phase: round.current_phase, displayName: player?.display_name });
}
