import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * GitHub Marketplace webhook receiver for the wryte-xyz App listing.
 *
 * Marketplace requires a webhook endpoint even for free listings. Wryte's
 * only plan is free, so purchase/cancel events carry no billing state to
 * act on — we verify the signature, log the event for visibility, and ack.
 *
 * Signature verification uses GITHUB_MARKETPLACE_WEBHOOK_SECRET (Vercel
 * env var, same value as the Secret field on the GitHub webhook form).
 * Fail-closed: if the secret is configured, unsigned/mismatched payloads
 * are rejected.
 */
export async function POST(request: Request) {
  const body = await request.text();

  const secret = process.env["GITHUB_MARKETPLACE_WEBHOOK_SECRET"];
  if (secret) {
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return new Response("invalid signature", { status: 401 });
    }
  }

  let action = "unknown";
  try {
    action = (JSON.parse(body) as { action?: string }).action ?? "unknown";
  } catch {
    // Non-JSON payload — still ack; the event header tells us what it was.
  }
  console.info(
    `[marketplace] event=${request.headers.get("x-github-event") ?? "?"} action=${action}`,
  );
  return new Response("ok");
}
