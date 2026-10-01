import { ConvexHttpClient } from "convex/browser";

let client: ConvexHttpClient | null = null;

export function shareClient(): ConvexHttpClient {
  if (client) return client;
  const url = process.env["NEXT_PUBLIC_CONVEX_URL"];
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  client = new ConvexHttpClient(url, { logger: false });
  return client;
}
