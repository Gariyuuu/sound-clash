import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import type { ProfileRow } from "@/types/database";

const DEFAULT_SETTINGS: ProfileRow["settings"] = {
  volume: { music: 80, ui: 60, effects: 80 },
  accessibility: { colorblind: false, highContrast: false, fontScale: 1, reducedMotion: false },
};

interface SettingsBody {
  theme?: string;
  background_key?: string;
  custom_background_url?: string | null;
  avatar_emoji?: string;
  settings?: {
    volume?: { music?: number; ui?: number; effects?: number };
    accessibility?: { colorblind?: boolean; highContrast?: boolean; fontScale?: number; reducedMotion?: boolean };
  };
}

// The one route in the app whose caller identity comes from a real Clerk
// session (`auth()`) rather than a client-supplied `playerId` — see
// CLAUDE.md's "DO NOT CHANGE WITHOUT REVIEW" for why every other route
// intentionally does NOT work this way (guest play has no session at all).
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json()) as SettingsBody;
  const current = await db.query.profiles.findFirst({ where: eq(profiles.id, userId) });
  if (!current) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const [updated] = await db
    .update(profiles)
    .set({
      ...(body.theme !== undefined ? { theme: body.theme } : {}),
      ...(body.background_key !== undefined ? { background_key: body.background_key } : {}),
      ...(body.custom_background_url !== undefined ? { custom_background_url: body.custom_background_url } : {}),
      ...(body.avatar_emoji !== undefined ? { avatar_emoji: body.avatar_emoji } : {}),
      ...(body.settings
        ? {
            settings: {
              volume: { ...DEFAULT_SETTINGS.volume, ...current.settings?.volume, ...body.settings.volume },
              accessibility: { ...DEFAULT_SETTINGS.accessibility, ...current.settings?.accessibility, ...body.settings.accessibility },
            },
          }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .where(eq(profiles.id, userId))
    .returning();

  return NextResponse.json({ profile: updated });
}
