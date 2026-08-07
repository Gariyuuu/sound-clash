import { NextResponse } from "next/server";
import { resolveRoundAnswer } from "@/lib/game/answer-service";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate-limit";
import type { AnswerCategory } from "@/types/database";

interface AnswerBody {
  playerId: string;
  answers: Partial<Record<AnswerCategory, string>>;
  usedHint: boolean;
}

export async function POST(request: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const limited = rateLimit(clientKeyFromRequest(request, "rounds:answer"), 15, 10_000);
  if (!limited.success) return NextResponse.json({ error: "Slow down." }, { status: 429 });

  const { roundId } = await params;
  const body = (await request.json()) as AnswerBody;

  const result = await resolveRoundAnswer({
    roundId,
    playerId: body.playerId,
    answers: body.answers,
    usedHint: body.usedHint,
  });

  return NextResponse.json(result.body, { status: result.status });
}
