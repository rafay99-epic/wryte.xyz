/**
 * GitHub Token API Route
 *
 * Acts as a bridge between Clerk's server-side OAuth API and the client.
 * The client cannot directly access Clerk's server SDK, so this endpoint
 * retrieves the user's GitHub OAuth token on their behalf and returns it.
 *
 * Auth flow:
 * 1. User authenticates with Clerk and connects their GitHub account via OAuth.
 * 2. Client calls GET /api/github/token.
 * 3. Server uses Clerk's SDK to look up the stored OAuth token for the current user.
 * 4. Token is returned to the client for direct GitHub API calls.
 */

import { NextResponse } from "next/server";
import { getGithubToken } from "@/lib/github-helpers";

/**
 * Retrieves the authenticated user's GitHub OAuth token from Clerk.
 * Returns 401 if the user is not authenticated or GitHub is not connected.
 */
export async function GET() {
  try {
    const result = await getGithubToken();

    // Discriminated union: presence of "error" key means auth failed
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, connected: false },
        { status: 401 },
      );
    }

    return NextResponse.json({ token: result.token });
  } catch (_err: unknown) {
    return NextResponse.json(
      { error: "Failed to retrieve GitHub token" },
      { status: 500 },
    );
  }
}
