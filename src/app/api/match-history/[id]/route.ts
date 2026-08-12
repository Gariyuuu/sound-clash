import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, safeQuery } from "@/lib/db/client";
import { match_history } from "@/lib/db/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const matchHistory = await safeQuery(
    () => db.query.match_history.findFirst({ where: eq(match_history.id, id) }),
    undefined
  );
  if (!matchHistory) return NextResponse.json({ error: "Match history not found." }, { status: 404 });

  return NextResponse.json({ matchHistory });
}
