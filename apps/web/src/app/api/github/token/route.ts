/**
 * GitHub OAuth Connection Status
 *
 * Reports whether the signed-in user has linked their GitHub account via
 * Clerk. The OAuth token itself is never returned to the browser — all
 * GitHub API calls are proxied through server routes and Convex actions
 * that look the token up server-side.
 */

import { getGithubToken } from "@wryte/logic/lib/github-helpers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await getGithubToken();

    if ("error" in result) {
      return NextResponse.json(
        { connected: false, error: result.error },
        { status: 401 },
      );
    }

    return NextResponse.json({ connected: true });
  } catch (_err: unknown) {
    return NextResponse.json(
      { connected: false, error: "Failed to retrieve GitHub connection" },
      { status: 500 },
    );
  }
}
