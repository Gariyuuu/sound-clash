import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import type { ProfileRow } from "@/types/database";

/**
 * Finds a profile by Clerk user id, creating it on first lookup if it
 * doesn't exist yet. This is the real fix for profile creation, not just a
 * fallback for it — the Clerk webhook (`/api/webhooks/clerk`) is not
 * currently registered in the Clerk Dashboard (a manual step Clerk doesn't
 * expose an API for), so relying on it alone left every single sign-in
 * without a `profiles` row, which in turn left `useIdentity()`'s
 * `isAuthed` (gated on the profile existing) permanently `false` even for a
 * genuinely signed-in user — the visible bug of the sign-in button never
 * updating after a real sign-in. `GET /api/profiles/me` now calls this on
 * every request, so the row exists the moment it's first needed regardless
 * of whether the webhook is ever configured. The webhook, if registered
 * later, becomes a redundant (harmless, `onConflictDoNothing`) fast path
 * rather than the only path.
 */
export async function ensureProfile(params: {
  userId: string;
  username?: string | null;
  email?: string | null;
}): Promise<ProfileRow> {
  const { userId, username, email } = params;

  const existing = await db.query.profiles.findFirst({ where: eq(profiles.id, userId) });
  if (existing) return existing;

  const desiredUsername = username ?? email?.split("@")[0] ?? "player";
  let candidate = desiredUsername.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  if (candidate.length < 2) candidate = `player${userId.slice(-6)}`;

  let finalUsername = candidate;
  let suffix = 0;
  while (await db.query.profiles.findFirst({ where: eq(profiles.username, finalUsername) })) {
    suffix += 1;
    finalUsername = `${candidate.slice(0, 16)}${suffix}`;
  }

  const [created] = await db.insert(profiles).values({ id: userId, username: finalUsername }).onConflictDoNothing().returning();
  if (created) return created;

  // Lost an insert race (e.g., a concurrent request, or the webhook firing
  // at the same instant) — the row now exists, so fetch and return it.
  const raced = await db.query.profiles.findFirst({ where: eq(profiles.id, userId) });
  if (!raced) throw new Error(`Failed to create or find profile for ${userId} after an insert race.`);
  return raced;
}
