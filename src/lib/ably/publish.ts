import "server-only";
import { Rest } from "ably";

/**
 * Server-side Ably publish helper — the replacement for what Supabase's
 * Postgres Changes gave us for free (see DECISIONS.md D-013). There is no
 * automatic DB-write-to-realtime bridge with Neon, so every mutating API
 * route that previously relied on a client subscribing to a table's
 * postgres_changes now explicitly calls `publish()` after writing, on the
 * same two channel-naming conventions the app already used
 * (`room:{roomId}` and `game:{gameId}` — see src/lib/game/types.ts).
 *
 * Uses the REST client (not Realtime) since API routes are one-shot
 * request/response, not long-lived connections — publishing over REST needs
 * no connection lifecycle management, which fits Vercel serverless well.
 */
let restClient: Rest | null = null;

function getRest(): Rest {
  if (!restClient) restClient = new Rest(process.env.ABLY_API_KEY!);
  return restClient;
}

export async function publish(channelName: string, eventName: string, data: unknown): Promise<void> {
  await getRest().channels.get(channelName).publish(eventName, data);
}

export function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

export function gameChannel(gameId: string): string {
  return `game:${gameId}`;
}
