import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rooms, room_messages } from "@/lib/db/schema";
import { publish, roomChannel } from "@/lib/ably/publish";
import { rateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

interface MessageBody {
  playerId: string;
  displayName: string;
  kind: "chat" | "reaction";
  body: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const limited = rateLimit(clientKeyFromRequest(request, "rooms:messages"), 20, 10_000);
  if (!limited.success) return NextResponse.json({ error: "Slow down." }, { status: 429 });

  const { code } = await params;
  const body = (await request.json()) as MessageBody;
  if (!body.body?.trim() || body.body.length > 280) {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }

  const room = await db.query.rooms.findFirst({ where: eq(rooms.code, code.toUpperCase()) });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const [message] = await db
    .insert(room_messages)
    .values({
      room_id: room.id,
      player_id: body.playerId,
      display_name: body.displayName.slice(0, 20),
      kind: body.kind,
      body: body.body.trim().slice(0, 280),
    })
    .returning();

  if (!message) return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  await publish(roomChannel(room.id), "message", message);
  return NextResponse.json({ success: true });
}
