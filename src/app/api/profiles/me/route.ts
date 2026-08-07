import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureProfile } from "@/lib/game/profile-service";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const user = await currentUser();
  const profile = await ensureProfile({
    userId,
    username: user?.username,
    email: user?.emailAddresses[0]?.emailAddress,
  });

  return NextResponse.json({ profile });
}
