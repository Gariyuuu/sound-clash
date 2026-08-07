"use client";

import { BaseRealtime, WebSocketTransport, FetchRequest } from "ably/modular";

let realtimeClient: BaseRealtime | null = null;

/**
 * Singleton browser Ably client, token-authenticated via /api/ably-token
 * (the API key is never sent to the browser).
 *
 * Uses the "modular" tree-shakable build rather than the default `Realtime`
 * export from "ably" — the default build's bundled UMD file fails to parse
 * under Next.js's webpack/SWC pipeline ("'super' keyword outside a method",
 * a parser bug on an arrow-function-calling-super pattern that's valid but
 * only present in that specific bundle). The modular build ships as a plain
 * ESM file and doesn't hit it. `WebSocketTransport` + `FetchRequest` are the
 * minimum plugins needed for realtime pub/sub with fetch-based auth.
 */
export function getAblyClient(): BaseRealtime {
  if (!realtimeClient) {
    realtimeClient = new BaseRealtime({
      authUrl: "/api/ably-token",
      plugins: { WebSocketTransport, FetchRequest },
    });
  }
  return realtimeClient;
}
