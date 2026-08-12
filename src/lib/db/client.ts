import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Single server-only Neon/Drizzle connection used by every API route.
 * There is no anon/service-role key split the way there was with Supabase
 * (see DECISIONS.md D-013) — every query already runs from a trusted
 * server-side route, so this one connection is the entire authorization
 * boundary alongside each route's own is_host/lock-ownership checks.
 *
 * Uses the Neon HTTP driver (`neon-http`), which is stateless and works
 * over fetch — the right choice for Vercel serverless functions (no
 * connection pooling/lifecycle to manage). It does not support interactive
 * transactions; the few places that need atomicity (the buzz-lock race)
 * rely on a single-statement `INSERT ... ON CONFLICT DO NOTHING` instead,
 * which needs no transaction wrapper.
 */
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });

/**
 * Wraps a *read* query so a Neon hiccup (quota, connection drop) degrades
 * to a safe empty/not-found value instead of throwing and turning a GET
 * route into an uncaught 500 -- this app has heavy unauthenticated guest
 * traffic (see CLAUDE.md), so a raw 500 hits logged-out players too, not
 * just signed-in ones. Logs server-side so the failure is still visible.
 * Never wrap a write (insert/update/delete) with this -- a failed
 * mutation must still surface to the caller. Never use this to relax the
 * songs-answer-secrecy guarantee (see CLAUDE.md/SECURITY.md) -- it exists
 * only for plain display/lookup reads.
 */
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("[db] query failed, returning fallback:", error);
    return fallback;
  }
}
