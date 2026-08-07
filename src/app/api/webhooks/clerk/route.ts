import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { ensureProfile } from "@/lib/game/profile-service";

/**
 * Optional fast path for `profiles` row creation on `user.created` — the
 * real, always-on path is `ensureProfile()`, called from `GET
 * /api/profiles/me` on every request regardless of whether this webhook is
 * ever registered in the Clerk Dashboard (see profile-service.ts's comment
 * for why that matters — Clerk has no API to register a webhook endpoint,
 * only a Dashboard UI flow, so this can't be provisioned the way Neon/Clerk
 * themselves were). Configure this URL as an Endpoint in the Clerk
 * dashboard (Webhooks), subscribed to at least the `user.created` event,
 * and set `CLERK_WEBHOOK_SIGNING_SECRET` from the endpoint's "Signing
 * Secret" in `.env.local`, if/when you want event-driven creation instead
 * of on-demand.
 */
export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type !== "user.created") {
    return NextResponse.json({ received: true });
  }

  const user = event.data;
  await ensureProfile({
    userId: user.id,
    username: user.username,
    email: user.email_addresses?.[0]?.email_address,
  });

  return NextResponse.json({ received: true });
}
