import { NextResponse } from "next/server";
import { Rest } from "ably";

/**
 * Mints a short-lived Ably token for the browser client — the API key
 * itself (ABLY_API_KEY, server-only) never reaches the client. Ably's
 * `Realtime` client, configured with `authUrl: "/api/ably-token"`, calls
 * this automatically whenever it needs a (re)new(ed) token.
 */
export async function GET() {
  const rest = new Rest(process.env.ABLY_API_KEY!);
  const tokenRequest = await rest.auth.createTokenRequest();
  return NextResponse.json(tokenRequest);
}
