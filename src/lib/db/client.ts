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
