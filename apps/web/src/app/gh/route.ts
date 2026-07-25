import { NextResponse } from "next/server";

/** Media that may arrive via /gh — anything else falls back to "commit". */
const KNOWN_MEDIUMS = new Set(["commit", "badge"]);

/**
 * Vanity redirect used by GitHub-facing attribution surfaces — the commit
 * line ("Published with Wryte (https://wryte.xyz/gh)") and the README
 * badge (/gh?utm_medium=badge). Keeps commits and READMEs free of UTM
 * query noise while Vercel Analytics still distinguishes the channels.
 */
export function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("utm_medium");
  const medium =
    requested && KNOWN_MEDIUMS.has(requested) ? requested : "commit";
  return NextResponse.redirect(
    new URL(`/?utm_source=github&utm_medium=${medium}`, request.url),
    302,
  );
}
