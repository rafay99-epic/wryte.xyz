import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(request: Request) {
  const body = await request.text();

  const secret = process.env["GITHUB_MARKETPLACE_WEBHOOK_SECRET"];
  if (!secret) {
    console.error("[marketplace] GITHUB_MARKETPLACE_WEBHOOK_SECRET is not set");
    return new Response("webhook secret not configured", { status: 500 });
  }
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

  let action = "unknown";
  try {
    action = (JSON.parse(body) as { action?: string }).action ?? "unknown";
  } catch {}
  console.info(
    `[marketplace] event=${request.headers.get("x-github-event") ?? "?"} action=${action}`,
  );
  return new Response("ok");
}
