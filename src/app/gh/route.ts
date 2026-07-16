import { NextResponse } from "next/server";

/**
 * Vanity redirect used by the commit attribution line
 * ("Published with Wryte (https://wryte.xyz/gh)") — keeps commit messages
 * free of UTM query noise while Vercel Analytics still sees the campaign.
 */
export function GET(request: Request) {
  return NextResponse.redirect(
    new URL("/?utm_source=github&utm_medium=commit", request.url),
    302,
  );
}
